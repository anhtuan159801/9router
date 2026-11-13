# CÁCH TÍCH HỢP SUPABASE VÀO 9ROUTER TRÊN KOYEB

## BƯỚC 1: Tạo table Supabase

Mở Supabase Dashboard: https://supabase.com/dashboard

Vào **SQL Editor** → **New query** → Dán code sau:

```sql
create table if not exists public.router_config_snapshots (
  instance_id text primary key,
  format_version integer not null,
  revision bigint not null check (revision > 0),
  ciphertext text not null,
  checksum text not null,
  updated_at timestamptz not null default now()
);

alter table public.router_config_snapshots enable row level security;
revoke all on table public.router_config_snapshots from anon, authenticated;
grant select, insert, update on table public.router_config_snapshots to service_role;
```

Click **Run** → OK.

## BƯỚC 2: Chạy script deploy (có Supabase)

```powershell
cd C:\AnhTuan\Tool\9router
.\deploy-koyeb.ps1
```

Script sẽ:
1. Tạo encryption key mới (in ra màn hình)
2. **LUU LẠI KEY ĐÓ** vào password manager (nếu mất = mất data)
3. Thêm 4 Supabase env vào Koyeb service
4. Redeploy service

## BƯỚC 3: Kiểm tra

Mở domain Koyeb → Thêm API key → Refresh page → Key vẫn còn (đã lưu vào Supabase).

## LƯU Ý QUAN TRỌNG

- **Encryption key** (32 byte base64) BẮT BUỘC phải lưu an toàn
- Nếu đổi key mới, cần chạy lại `setup-supabase-table.sql` để xóa snapshot cũ
- Data Supabase lưu: API keys, settings, combos, aliases, custom models
- Data KHÔNG lưu: usage history, request logs (vẫn ở SQLite local, mất khi Koyeb restart)
