import { FastifyRequest, FastifyReply } from 'fastify'
import LiveAzure, { LiveData } from '../service/LiveAzure'

class LiveControlller {
    async openLiveStream(req: FastifyRequest, rep: FastifyReply) {
        const live = await LiveAzure.getLiveStreamIngest() as LiveData

        // Send this link to an database to be able to get for others API'S
        const hslManifest = await LiveAzure.getHSLManifestPath(
            live.name,
            LiveAzure.getOutputName(live.name)
        )

        
        return live
    }

    async closeLiveStream(req: FastifyRequest<{
        Params: {
            id: string
        }
    }>, rep: FastifyReply) {

        const { id } = req.params

        const res = await LiveAzure.endLiveStream(id)

        if (!res) {
            return rep.code(400).send('Nao foi possivel finalizar essa live!')
        }


        return 'Live Finalizada com Sucesso'
    }
}

export default new LiveControlller()