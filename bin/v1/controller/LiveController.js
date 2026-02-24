"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LiveAzure_1 = __importDefault(require("../service/LiveAzure"));
class LiveControlller {
    async openLiveStream(req, rep) {
        const live = await LiveAzure_1.default.getLiveStreamIngest();
        const hslManifest = await LiveAzure_1.default.getHSLManifestPath(live.name, LiveAzure_1.default.getOutputName(live.name));
        return live;
    }
    async closeLiveStream(req, rep) {
        const { id } = req.params;
        const res = await LiveAzure_1.default.endLiveStream(id);
        if (!res) {
            return rep.code(400).send('Nao foi possivel finalizar essa live!');
        }
        return 'Live Finalizada com Sucesso';
    }
}
exports.default = new LiveControlller();
