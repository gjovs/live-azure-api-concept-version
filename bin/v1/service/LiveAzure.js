"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveAzure = void 0;
const dotenv = __importStar(require("dotenv"));
const uuid_1 = require("uuid");
dotenv.config({ path: __dirname + '/.env' });
const identity_1 = require("@azure/identity");
const arm_mediaservices_1 = require("@azure/arm-mediaservices");
dotenv.config();
const clientId = process.env.AZURE_CLIENT_ID;
const secret = process.env.AZURE_CLIENT_SECRET;
const tenantDomain = process.env.AZURE_TENANT_DOMAIN;
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
const accountName = process.env.AZURE_MEDIA_SERVICES_ACCOUNT_NAME;
class LiveAzure {
    getLiveEventName() {
        const unique = (0, uuid_1.v4)().split('-')[0];
        return `liveEventName-${unique}`;
    }
    _mediaServiceClient = null;
    longRunningOperationUpdateIntervalMs = 2000;
    allowAllInputRanges = {
        address: '0.0.0.0',
        name: "AllowAll",
        subnetPrefixLength: 0
    };
    liveEventInputAcesses = {
        ip: {
            allow: [
                this.allowAllInputRanges
            ]
        }
    };
    liveEventPreview = {
        accessControl: {
            ip: {
                allow: [
                    this.allowAllInputRanges
                ]
            }
        }
    };
    async loadMediaAccount() {
        const mediaAccount = await this._mediaServiceClient?.mediaservices.get(resourceGroup, accountName);
        return mediaAccount;
    }
    getCredential() {
        const credential = new identity_1.DefaultAzureCredential();
        return credential;
    }
    constructor(subscriptionId) {
        this._mediaServiceClient = new arm_mediaservices_1.AzureMediaServices(this.getCredential(), subscriptionId);
    }
    async liveEventCreate() {
        const location = (await this.loadMediaAccount()).location;
        const liveEventCreate = {
            location: location,
            description: "Primeiro teste para abrir live usando a SDK da azure no nodejs!",
            useStaticHostname: true,
            input: {
                streamingProtocol: arm_mediaservices_1.KnownLiveEventInputProtocol.Rtmp,
                accessControl: this.liveEventInputAcesses,
                accessToken: "9eb1f703b149417c8448771867f48501"
            },
            encoding: {
                encodingType: arm_mediaservices_1.KnownLiveEventEncodingType.PassthroughStandard
            },
            preview: this.liveEventPreview,
            streamOptions: [
                "LowLatency"
            ]
        };
        return liveEventCreate;
    }
    async getLiveStreamOutput(liveEventName, liveOutputName) {
        const asset = await this._mediaServiceClient?.assets.createOrUpdate(resourceGroup, accountName, `${liveOutputName}-asset`, {});
        const manifestName = liveOutputName + "output";
        let liveOutputCreate = null;
        if (asset?.name) {
            liveOutputCreate = {
                assetName: asset?.name,
                manifestName: manifestName,
                archiveWindowLength: "PT30M",
                hls: {
                    fragmentsPerTsSegment: 1
                }
            };
        }
        try {
            const output = await this._mediaServiceClient?.liveOutputs.beginCreateAndWait(resourceGroup, accountName, liveEventName, liveOutputName, liveOutputCreate, {
                updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
            });
            return output;
        }
        catch (error) {
            console.info(error);
            return false;
        }
    }
    async createStremaingLocator(assetName, locatorName) {
        const streamingLocator = {
            assetName,
            streamingPolicyName: "Predefined_ClearStreamingOnly"
        };
        const locator = await this._mediaServiceClient?.streamingLocators.create(resourceGroup, accountName, `${locatorName}locatorname`, streamingLocator);
        if (!locator) {
            return false;
        }
        return locator;
    }
    async getLiveStreamIngest() {
        const liveEventName = this.getLiveEventName();
        const liveEventCreate = await this.liveEventCreate();
        try {
            const liveEvent = await this._mediaServiceClient?.liveEvents.beginCreateAndWait(resourceGroup, accountName, liveEventName, liveEventCreate, {
                autoStart: true,
                updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
            });
            if (liveEvent?.input?.endpoints) {
                return {
                    url: liveEvent.input.endpoints[0].url,
                    accessToken: liveEvent.input.accessToken,
                    name: liveEvent.name,
                    id: liveEvent.name?.split("-")[1]
                };
            }
            return false;
        }
        catch (error) {
            console.info(error);
            return false;
        }
    }
    getOutputName(liveEventName) {
        return `liveOutputName-${liveEventName.split("-")[1]}`;
    }
    async getHSLManifestPath(liveEventName, liveOutputName) {
        const output = await this.getLiveStreamOutput(liveEventName, liveOutputName);
        console.log(output.name);
        const locator = await this.createStremaingLocator(output.assetName, liveOutputName);
        const streamingEndpoint = await this._mediaServiceClient?.streamingEndpoints.get(resourceGroup, accountName, `default`);
        if (streamingEndpoint?.resourceState !== "Running") {
            await this._mediaServiceClient?.streamingEndpoints.beginStartAndWait(resourceGroup, accountName, `default`, {
                updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
            });
        }
        const { hostName } = streamingEndpoint;
        const { manifestName } = output;
        const { streamingLocatorId } = locator;
        const hlsFormat = "format=m3u8-cmaf";
        const manifestBase = `https://${hostName}/${streamingLocatorId}/${manifestName}.ism/manifest`;
        const hlsManifest = `${manifestBase}(${hlsFormat})`;
        return hlsManifest;
    }
    async endLiveStream(liveId) {
        const liveEventName = `liveEventName-${liveId}`;
        const liveOutputName = `liveOutputName=${liveId}`;
        const liveOutPutForDelete = await this._mediaServiceClient?.liveOutputs.get(resourceGroup, accountName, liveEventName, liveOutputName);
        if (liveOutPutForDelete) {
            try {
                await this._mediaServiceClient?.liveOutputs.beginDeleteAndWait(resourceGroup, accountName, liveEventName, liveOutputName, {
                    updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
                });
            }
            catch (error) {
                console.log(error);
                return false;
            }
        }
        const liveEventForStop = await this._mediaServiceClient?.liveEvents.get(resourceGroup, accountName, liveEventName);
        if (liveEventForStop?.resourceState == "Running") {
            try {
                await this._mediaServiceClient?.liveEvents.beginStopAndWait(resourceGroup, accountName, liveEventName, {
                    removeOutputsOnStop: true
                });
            }
            catch (error) {
                console.log(error);
                return false;
            }
        }
        try {
            await this._mediaServiceClient?.liveEvents.beginDeleteAndWait(resourceGroup, accountName, liveEventName, {
                updateIntervalInMs: this.longRunningOperationUpdateIntervalMs
            });
            return true;
        }
        catch (error) {
            console.log(error);
            return false;
        }
    }
}
exports.LiveAzure = LiveAzure;
exports.default = new LiveAzure(subscriptionId);
