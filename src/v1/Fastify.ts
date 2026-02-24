import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { liveRoutes } from './routes';

class App {
  declare app: FastifyInstance;

  constructor() {
    this.app = Fastify({
      logger: true,
    });
  
    this.middlewares();
    this.routes();
  }

  private async middlewares() {
    await this.app.register(cors, {
      origin: true,
    });
  }

  private routes() {
    this.app.register(liveRoutes, {
      prefix: "/live"
    });
  }
}

export default new App().app;