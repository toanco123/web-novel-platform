-- Dọn log của pg_cron: mỗi lần chạy job ghi một dòng vào cron.job_run_details (job xuất bản chương
-- hẹn giờ chạy mỗi phút, khoảng 1.440 dòng / ngày) và bảng này không tự dọn.
-- Mỗi ngày lúc 03:00 (giờ UTC của cron) xóa log cũ hơn 7 ngày.

select cron.schedule(
  'cleanup-cron-logs',
  '0 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
