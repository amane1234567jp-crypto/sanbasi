// サンバーシ（3人のリバーシ）の「とうろく」と「よびだし」の中継。テレビ電話リバーシの rv-push を写して 3人向けにしたもの。表は sb_ だけ
// 端末は 自分で作った id と secret で名乗る（ログインなし）。相手の id は、一度つながった（とうろく・いっしょに遊んだ）相手だけが知っている。
//   POST {op:"reg",     id, secret, names, expo?}       … 自分の名前（1台で2人なら2つ）と アプリの通知の宛先（Expo トークン）を登録・更新
//   POST {op:"accept",  id, secret, to, names, url?}    … とうろくリンクを開いた：招待した人（to）に知らせる（通知を受けとれれば 通知も）
//   POST {op:"pending", id, secret}                     … 自分あての「とうろく」を受けとる（受けとったら消す）
//   POST {op:"call",    id, secret, to, title, body, url, tag} … 相手に「あそぼう」の通知を送る
//   POST {op:"wait",    id, secret, to:[id..], room, n, names} … to の人たちを 自分の部屋で 待っている（5秒ごとに 送りなおす）。
//                                                    to のうち 自分を待っている人（20秒以内）を others で返す
//   POST {op:"peek",    id, secret}                  … 自分を 待っている人 ぜんぶ（others：[{id, room, n, names}]）
//   POST {op:"unwait",  id, secret}                  … 待つのを やめた（2026-11-24：おなじころに よびあっても つながるように）
// （Supabase に デプロイ済み：uchinoaji プロジェクトの sb-push。この控えと 中身は同じ）
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://amane1234567jp-crypto.github.io", "https://www.uchinoaji.com"];
const originOk = (o: string) => ORIGINS.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
async function sha(s: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(h, b => b.toString(16).padStart(2, "0")).join("");
}
const ok = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(v);
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const namesOf = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 2).map(x => clip(x, 12)).filter(Boolean);

async function me(id: string, secret: string) {
  if (!ok(id) || !ok(secret)) return null;
  const { data, error } = await db.from("sb_devices").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.secret_hash !== await sha(secret)) return null;
  return data;
}
async function expoSend(to: string, title: string, body: string, data: Record<string, unknown>, ttl: number) {
  const msg = { to, title, body, sound: "default", priority: "high", ttl, channelId: "call", interruptionLevel: "time-sensitive", data };
  const r = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(msg) });
  const j = await r.json().catch(() => ({}));
  const t = j && j.data && (Array.isArray(j.data) ? j.data[0] : j.data);
  if (t && t.status === "ok") return "ok";
  return (t && t.details && t.details.error) || ("http " + r.status);
}
const joined = (n: string[]) => n.join("・") || "あいて";

async function handle(b: Record<string, any>) {
  if (b.op === "reg") {
    if (!ok(b.id) || !ok(b.secret)) return [400, { error: "bad id" }];
    const h = await sha(b.secret);
    const { data: cur, error: e1 } = await db.from("sb_devices").select("secret_hash").eq("id", b.id).maybeSingle();
    if (e1) return [500, { error: e1.message }];
    if (cur && cur.secret_hash !== h) return [403, { error: "secret" }];
    const row: Record<string, unknown> = { id: b.id, secret_hash: h, names: namesOf(b.names), updated_at: new Date().toISOString() };
    if (typeof b.expo === "string" && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(b.expo)) row.expo = b.expo;
    else if (b.clear) row.expo = null;
    const { error: e2 } = await db.from("sb_devices").upsert(row);
    if (e2) return [500, { error: e2.message }];
    return [200, { ok: true, push: !!row.expo || (!!cur && !b.clear) }];
  }
  if (b.op === "accept") {
    const from = await me(b.id, b.secret);
    if (!from) return [403, { error: "who" }];
    if (!ok(b.to) || b.to === from.id) return [400, { error: "bad to" }];
    const names = namesOf(b.names).length ? namesOf(b.names) : namesOf(from.names);
    const { error } = await db.from("sb_pending").upsert({ to_id: b.to, from_id: from.id, names, at: new Date().toISOString() }, { onConflict: "to_id,from_id" });
    if (error) return [500, { error: error.message }];
    const { data: to } = await db.from("sb_devices").select("expo").eq("id", b.to).maybeSingle();
    if (to && to.expo) { try { await expoSend(to.expo, "サンバーシ", `${joined(names)}が とうろく しました`, { url: clip(b.url, 400), tag: "sb-accept", from: from.id, at: Date.now() }, 3600); } catch (e) { } }
    return [200, { ok: true }];
  }
  if (b.op === "pending") {
    const m = await me(b.id, b.secret);
    if (!m) return [403, { error: "who" }];
    const { data } = await db.from("sb_pending").select("from_id,names,at").eq("to_id", m.id).order("at", { ascending: true }).limit(20);
    if (data && data.length) await db.from("sb_pending").delete().eq("to_id", m.id).in("from_id", data.map((r: any) => r.from_id));
    return [200, { ok: true, list: (data || []).map((r: any) => ({ pid: r.from_id, names: r.names })) }];
  }
  if (b.op === "wait" || b.op === "peek" || b.op === "unwait") {
    const m = await me(b.id, b.secret);
    if (!m) return [403, { error: "who" }];
    if (b.op === "unwait") { await db.from("sb_waits").delete().eq("host_id", m.id); return [200, { ok: true }]; }
    const fresh = new Date(Date.now() - 20e3).toISOString();
    let q = db.from("sb_waits").select("host_id,room,n,names,at").contains("to_ids", [m.id]).gt("at", fresh).neq("host_id", m.id);
    if (b.op === "wait") {
      const to = (Array.isArray(b.to) ? b.to : []).filter(ok).filter((x: string) => x !== m.id).slice(0, 4);
      if (!to.length) return [400, { error: "bad to" }];
      if (!/^[a-z0-9]{4,40}$/.test(String(b.room || ""))) return [400, { error: "bad room" }];
      const { error } = await db.from("sb_waits").upsert({ host_id: m.id, to_ids: to, room: b.room, n: Math.max(0, Math.min(3, b.n | 0)), names: namesOf(b.names), at: new Date().toISOString() });
      if (error) return [500, { error: error.message }];
      q = q.in("host_id", to);
    }
    // ついでに 古い待ちを そうじ（1時間より前）
    if (Math.random() < 0.05) await db.from("sb_waits").delete().lt("at", new Date(Date.now() - 3600e3).toISOString());
    const { data } = await q.order("at", { ascending: false }).limit(5);
    return [200, { ok: true, others: (data || []).map((r: any) => ({ id: r.host_id, room: r.room, n: r.n, names: r.names })) }];
  }
  if (b.op === "call") {
    const from = await me(b.id, b.secret);
    if (!from) return [403, { error: "who" }];
    if (!ok(b.to)) return [400, { error: "bad to" }];
    // いたずら防止：1時間に 60回まで（3人なので リバーシの倍）
    const since = new Date(from.calls_since).getTime(), now = Date.now();
    const fresh = now - since > 3600e3, calls = fresh ? 1 : from.calls + 1;
    if (calls > 60) return [429, { error: "too many" }];
    await db.from("sb_devices").update({ calls, calls_since: fresh ? new Date().toISOString() : from.calls_since }).eq("id", from.id);
    const { data: to } = await db.from("sb_devices").select("id,expo").eq("id", b.to).maybeSingle();
    if (!to || !to.expo) return [200, { ok: false, reason: "nosub" }];
    try {
      const res = await expoSend(to.expo, clip(b.title, 60) || "サンバーシ", clip(b.body, 120), { url: clip(b.url, 400), tag: clip(b.tag, 40), from: from.id, at: now }, 600);
      if (res === "ok") return [200, { ok: true }];
      if (res === "DeviceNotRegistered") { await db.from("sb_devices").update({ expo: null }).eq("id", to.id); return [200, { ok: false, reason: "gone" }]; }
      return [200, { ok: false, reason: "expo " + res }];
    } catch (e) { return [200, { ok: false, reason: "expo net" }]; }
  }
  return [400, { error: "op" }];
}

Deno.serve(async req => {
  const o = req.headers.get("origin") || "";
  const cors = { "Access-Control-Allow-Origin": originOk(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("", { status: 405, headers: cors });
  let status = 500, body: unknown = { error: "server" };
  try {
    const b = await req.json();
    [status, body] = (await handle(b)) as [number, unknown];
    if (status >= 400) console.log(JSON.stringify({ op: b && b.op, status, error: (body as any) && (body as any).error, id: String((b && b.id) || "").slice(0, 6), to: String((b && b.to) || "").slice(0, 6) }));
  } catch (e) { body = { error: String(e).slice(0, 200) }; console.log(JSON.stringify({ status: 500, error: String(e).slice(0, 200) })); }
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
});
