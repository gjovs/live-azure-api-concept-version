"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const routes_1 = require("./routes");
class App {
    constructor() {
        this.app = (0, fastify_1.default)({
            logger: true,
        });
        this.middlewares();
        this.routes();
    }
    async middlewares() {
        await this.app.register(cors_1.default, {
            origin: true,
        });
    }
    routes() {
        this.app.register(routes_1.liveRoutes, {
            prefix: "/live"
        });
    }
}
exports.default = new App().app;
