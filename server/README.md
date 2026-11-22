# サンバーシの中継（Supabase：uchinoaji プロジェクト。表は sb_ だけ、関数は sb-push）
- テレビ電話リバーシの rv-push とは別。公開中のリバーシには影響しない
- sb-push/index.ts … Edge Function（verify_jwt なし。端末の id と secret で名乗る）
- migration.sql … 表（sb_devices・sb_pending。RLS 有効・ポリシーなし＝中継だけが読み書き）
- 手元のテストは tests/mock-relay.js（同じ op を まねる）
