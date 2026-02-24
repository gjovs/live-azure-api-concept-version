import server from "../v1/Fastify";

const port = 3333

async function run() {
    try {
        await server.listen({
            port
        }).then(() => console.log(`Running in port ${port}`))
    } catch (error) {
        console.log(error)
        process.exit(1)
    }
}


run()