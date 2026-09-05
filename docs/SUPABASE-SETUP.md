# 开启金陵访古图跨设备同步

网页继续由 GitHub Pages 提供。照片、到访状态、开放情况和确认结果存放在你自己的 Supabase 项目里。新上传照片使用私有存储，网页原有公开照片保持原状。

## 需要你完成的账号步骤

1. 打开 https://supabase.com/dashboard ，注册并创建一个项目。选择适合自己的服务方案；本次代码不会自动开通收费服务。数据库密码自己保管，无需发给助手。
2. 在项目 SQL Editor 中运行本仓库 `supabase/migrations/001_heritage_sync.sql`。这是首次安装脚本，只在新项目运行一次。
3. 在 Authentication / Users 中使用 Add user 创建你自己的邮箱密码账号并确认邮箱；在 Authentication 设置中关闭新用户注册。网页不提供公开注册入口。
4. 复制该用户的 UUID，在 SQL Editor 中运行下面一句，把 UUID 替换成自己的实际值：

```sql
insert into public.heritage_members (user_id) values ('你的用户UUID');
```

5. 从项目 Connect / API Keys 获取 Project URL 和 **Publishable key**（旧项目可用 anon key）。它们是允许放在前端的公开配置。不要提供 `service_role`、`sb_secret_...` 或数据库密码。
6. 在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 新增两个 Repository variables：`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`，填入第5步的值。随后重新运行 Publish GitHub Pages 工作流。
7. 打开 https://yuxin-ip.github.io/jinling-heritage-map/ ，点击“跨设备同步”登录同一个账号。手机和电脑都使用它。第一次可选择“导入本机已有确认结果”；云端已有答案不会被本机旧答案覆盖。

## 记录规则

- 多子项单位上传前可选择具体子项，也可以仅记录到单位；后者不把全部子项标为去过。
- 上传照片会把对应点位改为自动按照片判断；“去过但无照片”记为已到访；“尚未去过”可更正旧判断，不删除照片。
- “去过无照片”统计要求实际没有任何已关联照片。已有照片的点位即使按过该按钮，也不计入无照片数量。
- 不对外开放、对外开放、不确定，与到访状态分别保存。同一点可以既去过又不开放。
- 不同点位、不同字段独立保存；两台设备同时修改同一字段时，以最后一次成功保存为准。
- 页面重新获得焦点以及每60秒可见时读取最新记录，也可手动同步。断网保存失败时明确报错，不把未保存的数据当成同步成功。
- 每次最多10张 JPG、PNG、WebP；每张不超过10MB。图片不压缩，原始文件可能包含拍摄位置等 EXIF，保存在私有桶。HEIC 需先转为 JPG。
- 新照片不进入公开 GitHub 仓库；存储签名链接有效期1小时，页面同步时重新生成。

## 启用后的验收

必须在真实项目完成这些验证后才能宣称同步上线：登录许可账号；上传一张照片并在第二台设备读到；分别更改到访和开放状态并核对统计；确认旧照片并检查第二台设备待确认数；匿名用户不能读私有表或下载照片；另一个未加入 heritage_members 的账号不能上传、读取或写入记录；断网时保存不能显示成功。当前未配置项目时，界面会显示尚未启用，上传和状态按钮不能操作。

安全由数据库和存储的行级权限执行，所有读写必须通过本人登录身份与管理员许可名单。修改前端按钮或请求参数不能绕过权限。

参考：[Supabase Auth](https://supabase.com/docs/guides/auth)、[行级权限](https://supabase.com/docs/guides/database/postgres/row-level-security)、[私有照片权限](https://supabase.com/docs/guides/storage/security/access-control)。
