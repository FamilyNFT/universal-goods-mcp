# @universal-goods/mcp

Model Context Protocol (MCP) server for Universal Goods. Exposes product, batch, item, schema, metadata, and organization tools to MCP-compatible clients (Claude Code, Claude Desktop, etc.) over a streamable HTTP transport, with OAuth 2.1 bearer-token auth against the Universal Goods server.

## Endpoints

- `GET  /health` — liveness probe
- `GET  /.well-known/oauth-protected-resource` — OAuth 2.0 Protected Resource Metadata (RFC 9728)
- `ALL  /mcp` — MCP streamable HTTP transport (requires `Authorization: Bearer <jwt>`)

Unauthorized calls to `/mcp` return `401` with a `WWW-Authenticate` header pointing to the resource metadata document, so compliant clients can discover the authorization server automatically.

## Tools

Registered in `src/tools/`:

- `whoami` — current authenticated principal
- `products` — list, read, create, update products and checklists
- `batches` — list, read, create, update batches
- `items` — list, read, create, update items
- `schemas` — read entity types and schemas
- `metadata` — read and write entity details
- `organization` — list organizations, read current organization

Prompts are registered in `src/prompts/`.

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable       | Default                             | Description                                              |
| -------------- | ----------------------------------- | -------------------------------------------------------- |
| `PORT`         | `3100`                              | Port to listen on                                        |
| `RESOURCE_URL` | `http://localhost:3100`             | Public URL of this MCP server                            |
| `AUTH_ISSUER`  | `http://localhost:4060/api/auth`    | OAuth issuer used to verify JWTs                         |
| `AUTH_SERVER`  | same as `AUTH_ISSUER`               | Authorization server advertised in resource metadata    |
| `UG_API_URL`   | `http://localhost:4060`             | Base URL of the Universal Goods API used by tool calls   |

JWTs are verified against `${AUTH_SERVER}/jwks` with issuer `AUTH_ISSUER`.

## Development

```sh
bun install
bun run dev      # vite dev server with HMR on PORT
```

## Build & run

```sh
bun run build    # outputs dist/index.js
bun run start    # node dist/index.js
```

## Requirements

- Bun 1.x (or Node 20+ with a compatible package manager)
- A running Universal Goods server that issues OAuth JWTs and exposes JWKS at `${AUTH_SERVER}/jwks`

## License

TBD.
