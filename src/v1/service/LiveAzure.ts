import * as dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid'
dotenv.config({ path: __dirname + '/.env' });

import { DefaultAzureCredential } from '@azure/identity'
import { AzureMediaServices, IPRange, KnownLiveEventEncodingType, KnownLiveEventInputProtocol, LiveEvent, LiveEventInputAccessControl, LiveEventPreview, LiveOutput, MediaService, StreamingEndpoint, StreamingEndpointsGetResponse, StreamingLocator, StreamingLocatorsCreateResponse } from '@azure/arm-mediaservices'

dotenv.config()


const clientId: string = process.env.AZURE_CLIENT_ID as string;
const secret: string = process.env.AZURE_CLIENT_SECRET as string;
const tenantDomain: string = process.env.AZURE_TENANT_DOMAIN as string;
const subscriptionId: string = process.env.AZURE_SUBSCRIPTION_ID as string
const resourceGroup: string = process.env.AZURE_RESOURCE_GROUP as string
const accountName: string = process.env.AZURE_MEDIA_SERVICES_ACCOUNT_NAME as string

export interface LiveData { url: string; accessToken: string; name: string; id: string}

export class LiveAzure {
    // createUniqueLiveEventName
    private getLiveEventName() {
        const unique: string = uuidv4().split('-')[0]
        
        return `liveEventName-${unique}`
    }

    private _mediaServiceClient: AzureMediaServices | null = null
    // Configs
    protected longRunningOperationUpdateIntervalMs: number = 2000
    protected allowAllInputRanges: IPRange = {
        address: '0.0.0.0',
        name: "AllowAll",
        subnetPrefixLength: 0
    }
    protected liveEventInputAcesses: LiveEventInputAccessControl = {
        ip: {
            allow: [
                this.allowAllInputRanges
            ]
        }
    }
    protected liveEventPreview: LiveEventPreview = {
        accessControl: {
            ip: {
                allow: [
                    this.allowAllInputRanges
                ]
            }
        }
    }

    private async loadMediaAccount(): Promise<MediaService | undefined> {
        const mediaAccount = await this._mediaServiceClient?.mediaservices.get(resourceGroup, accountName)
        return mediaAccount
    }

    private getCredential(): DefaultAzureCredential {
        const credential = new DefaultAzureCredential()
        return credential
    }


    constructor(subscriptionId: string) {
        this._mediaServiceClient = new AzureMediaServices(this.getCredential(), subscriptionId)
    }

    private async liveEventCreate(): Promise<LiveEvent> {
        const location = (await this.loadMediaAccount() as MediaService).location

        const liveEventCreate = {
            location: location,
            description: "Primeiro teste para abrir live usando a SDK da azure no nodejs!",
            useStaticHostname: true,
            input: {
                streamingProtocol: KnownLiveEventInputProtocol.Rtmp,
                accessControl: this.liveEventInputAcesses,
                // accessToken: "9eb1f703b149417c8448771867f48501" // ONLY FOR TEST REASONS
            },
            encoding: {
                encodingType: KnownLiveEventEncodingType.PassthroughStandard
            },
            preview: this.liveEventPreview,
            streamOptions: [
                "LowLatency"
            ]
        } as LiveEvent

        return liveEventCreate
    }


    private async getLiveStreamOutput(liveEventName: string, liveOutputName: string) {
        const asset = await this._mediaServiceClient?.assets.createOrUpdate(resourceGroup, accountName, `${liveOutputName}-asset`, {})
        const manifestName: string = liveOutputName + "output"
        let liveOutputCreate: LiveOutput | any = null

        if (asset?.name) {
            liveOutputCreate = {
                assetName: asset?.name as string,
                manifestName: manifestName,
                archiveWindowLength: "PT30M",
                hls: {
                    fragmentsPerTsSegment: 1
                }
            }
        }
        try {
            const output = await this._mediaServiceClient?.liveOutputs.beginCreateAndWait(
                resourceGroup,
                accountName,
                liveEventName,
                liveOutputName,
                liveOutputCreate,
                {
                    updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
                }
            )
            return output
        } catch (error) {
            console.info(error);
            return false
        }
    }

    private async createStremaingLocator(assetName: string, locatorName: string): Promise<StreamingLocatorsCreateResponse | boolean> {
        const streamingLocator = {
            assetName,
            streamingPolicyName: "Predefined_ClearStreamingOnly"
        }

        const locator = await this._mediaServiceClient?.streamingLocators.create(
            resourceGroup,
            accountName,
            `${locatorName}locatorname`,
            streamingLocator)

        if (!locator) {
            return false
        }
        return locator
    }

    public async getLiveStreamIngest(): Promise<LiveData | boolean> {
        const liveEventName = this.getLiveEventName()
        const liveEventCreate = await this.liveEventCreate()
        try {
            const liveEvent = await this._mediaServiceClient?.liveEvents.beginCreateAndWait(
                resourceGroup,
                accountName,
                liveEventName,
                liveEventCreate,
                {
                    autoStart: true,
                    updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
                }
            )

            if (liveEvent?.input?.endpoints) {
                return {
                    url: liveEvent.input.endpoints[0].url as string,
                    accessToken: liveEvent.input.accessToken as string,
                    name: liveEvent.name as string,
                    id: liveEvent.name?.split("-")[1] as string
                }
            }
            return false

        } catch (error) {
            console.info(error);
            return false
        }
    }

    public getOutputName(liveEventName: string): string {
        return `liveOutputName-${liveEventName.split("-")[1]}`
    }

    public async getHSLManifestPath(liveEventName: string, liveOutputName: string) {

        const output = await this.getLiveStreamOutput(liveEventName, liveOutputName) as LiveOutput

        console.log(output.name) // save this name to delete (tentar fazer com o mesmo id para facilitar)

        const locator = await this.createStremaingLocator(output.assetName as string, liveOutputName) as StreamingLocator


        const streamingEndpoint = await this._mediaServiceClient?.streamingEndpoints.get(resourceGroup, accountName, `default`) as StreamingEndpointsGetResponse;

        if (streamingEndpoint?.resourceState !== "Running") {
            await this._mediaServiceClient?.streamingEndpoints.beginStartAndWait(resourceGroup, accountName, `default`, {
                updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
            })
        }

        const { hostName } = streamingEndpoint

        const { manifestName } = output

        const { streamingLocatorId } = locator

        const hlsFormat: string = "format=m3u8-cmaf"

        const manifestBase = `https://${hostName}/${streamingLocatorId}/${manifestName}.ism/manifest`
        const hlsManifest = `${manifestBase}(${hlsFormat})`

        return hlsManifest
    }


    public async endLiveStream(liveId: string) {
        const liveEventName = `liveEventName-${liveId}`
        const liveOutputName = `liveOutputName=${liveId}`

        const liveOutPutForDelete = await this._mediaServiceClient?.liveOutputs.get(
            resourceGroup,
            accountName,
            liveEventName,
            liveOutputName,
        )

        // Delete liveOutput 
        if (liveOutPutForDelete) {
            try {
                await this._mediaServiceClient?.liveOutputs.beginDeleteAndWait(
                    resourceGroup,
                    accountName,
                    liveEventName,
                    liveOutputName,
                    {
                        updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
                    }
                )
            } catch (error) {
                console.log(error);
                return false
            }
        }


        const liveEventForStop = await this._mediaServiceClient?.liveEvents.get(
            resourceGroup,
            accountName,
            liveEventName
        );
        
        
        // Stop Live Event 
        if (liveEventForStop?.resourceState == "Running") {
            try {
                await this._mediaServiceClient?.liveEvents.beginStopAndWait(
                    resourceGroup,
                    accountName,
                    liveEventName,
                    {
                        removeOutputsOnStop: true
                    }
                )
            } catch (error) {
                console.log(error)
                return false
            }
        }

        // Deleting Live Event 

        try { 
            await this._mediaServiceClient?.liveEvents.beginDeleteAndWait(
                resourceGroup,
                accountName,
                liveEventName, 
                {
                    updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
                }
            ) 
            return true
        } catch (error) {
            console.log(error)
            return false
        }
    }
}



export default new LiveAzure(subscriptionId);
