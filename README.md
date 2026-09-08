# 秋招投递簿

一个无需安装的职位投递管理网页，支持 Supabase 账号登录和多设备云端同步。

## 使用

用浏览器打开 `index.html`，注册或登录后即可使用。新增或编辑职位后，记录会保存到 Supabase 云数据库。

建议定期使用右上角的“导出备份”，另存一份 JSON 文件。

## 已有功能

- 记录公司、职位、地点、薪资、渠道、链接和职位描述
- 追踪关注、投递、笔试、面试、Offer 等状态
- 记录投递日期、截止日期、下一节点日期与时间和备注
- 记录招聘会的名称、日期、时间和地点
- 使用月历查看招聘会、投递截止、笔试、面试及其他节点
- 搜索、状态筛选、排序和概览统计
- Supabase 云端持久化、JSON 导入与导出
- 适配电脑和手机浏览器

## Supabase 云同步准备

在 Supabase Dashboard 的 SQL Editor 中运行 `supabase-schema.sql`，即可创建职位表及用户数据隔离策略。网页已经配置 Project URL 和 Publishable key，并接入邮箱密码登录与云端读写。

部署前需要进入 Supabase Dashboard 的 Authentication -> URL Configuration，将 Site URL 设置为网页最终地址，例如 `https://用户名.github.io/autumn-job-tracker/`，并将同一地址加入 Redirect URLs，以便注册确认邮件能正确返回网页。
