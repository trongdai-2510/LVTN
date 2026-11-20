# Local Dev Scripts

Start API + Admin + local AI for the media assistant (when Ollama is installed):

```bat
scripts\dev\start-api-admin.bat
```

The launcher starts Ollama only if `127.0.0.1:11434` is not already listening. The model must already be installed as `qwen3-vl:2b-instruct`; the assistant reads project files locally. If starting API and Admin in separate terminals, run `powershell -ExecutionPolicy Bypass -File api/scripts/startLocalAi.ps1` from the repository root as well.

After schema changes:

```bat
cd /d D:\WebSongThanh\api
npm.cmd run migrate:latest
```

Backfill product highlight specs if the local database was restored or recreated:

```bat
cd /d D:\WebSongThanh\api
npm.cmd run backfill:product-highlights -- --apply
```

Start frontend in a separate terminal:

```bat
cd /d D:\WebSongThanh\frontend
npm.cmd run dev
```

Stop stuck ports:

```bat
scripts\dev\stop-dev-ports.bat
```

Clean admin cache:

```bat
scripts\dev\clean-admin-cache.bat
```

Admin:

```txt
http://localhost:3001/admin/login
```

Frontend:

```txt
http://localhost:3000
```

API:

```txt
http://localhost:4000
```

Tài khoản quản trị khởi tạo lấy từ các biến `SUPER_ADMIN_*` trong `api/.env` khi chạy seed trên database mới. Không dùng mật khẩu mặc định của seed cho môi trường bàn giao.

End-user smoke QA:

```bat
node scripts\qa\end-user-smoke.mjs
```

API contract smoke QA:

```bat
node scripts\qa\api-contract-smoke.mjs
```

Admin route smoke QA:

```bat
node scripts\qa\admin-route-smoke.mjs
```

Public UI smoke QA:

```bat
node scripts\qa\public-ui-smoke.mjs
```

QA import fixture:

```txt
scripts\qa\fixtures\qa-import-mapping-profile.csv
```
