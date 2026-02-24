"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LiveController_1 = __importDefault(require("../../controller/LiveController"));
async function appRoutes(server) {
    server.post("/openLiveStreaming", LiveController_1.default.openLiveStream);
    server.post("/closeLiveStreaming", LiveController_1.default.closeLiveStream);
}
exports.default = appRoutes;
