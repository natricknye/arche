#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { createSign } from "node:crypto"

const appId = process.env.ARCHE_APP_ID
const keyPath = process.env.ARCHE_APP_KEY
const installationId = process.env.ARCHE_INSTALLATION_ID

if (!appId || !keyPath || !installationId) {
  console.error("Set ARCHE_APP_ID, ARCHE_APP_KEY and ARCHE_INSTALLATION_ID.")
  process.exit(1)
}

const key = readFileSync(keyPath, "utf8")
const encode = (value) => Buffer.from(value).toString("base64url")
const now = Math.floor(Date.now() / 1000)
const header = encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
const payload = encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: Number(appId) }))

const signer = createSign("RSA-SHA256")
signer.update(`${header}.${payload}`)
signer.end()
const jwt = `${header}.${payload}.${signer.sign(key).toString("base64url")}`

const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "arche-agent",
  },
})

const data = await response.json()

if (!response.ok) {
  console.error(JSON.stringify(data, null, 2))
  process.exit(1)
}

process.stdout.write(data.token)
