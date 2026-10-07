// Always-on energy historian + HTTP API.
//
// Polls the dish's history ring buffer directly (reusing the frontend's
// grpc-web transport and decoder so the two never drift), folds new per-second
// power readings into per-minute energy buckets, and persists completed minutes
// to an NDJSON log. Serves day/week/month energy totals over /api/energy.
//
// Energy is integrated ONLY over minutes actually sampled â€” historian downtime
// (sleep, restart, Wi-Fi drop) shows up as reduced coverage, never as invented
// kWh. Short gaps (â‰¤15 min) are backfilled losslessly from the ring buffer on
// the next poll.
//
// Run: npm run historian   (foreground; see collector/README for always-on setup)

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import {
  identityFromEnv,
  resolveHostIdentity,
  type HostNetworkIdentity,
} from "../core/hostNetworkIdentity.ts";
import { clientIsHost } from "../core/routerClientUpdate.ts";
import { join, resolve } from "node:path";
import { createFileRegistry, fromBinary, toJson, type DescMessage } from "@bufbuild/protobuf";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";
import { grpcWebUnaryCall } from "../core/grpcWeb.ts";
import { routerPresence, type RouterPresence } from "../cor¶»§q«^