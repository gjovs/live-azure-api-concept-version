import { FastifyInstance } from "fastify";
import LiveController from "../../controller/LiveController";

export default async function appRoutes(server: FastifyInstance) {
    server.post("/openLiveStreaming", LiveController.openLiveStream)
    server.post("/closeLiveStreaming", LiveController.closeLiveStream)
}