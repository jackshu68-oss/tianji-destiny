# 道法自然商业上线清单

这份清单对应当前代码中的真实 Stripe Checkout、Webhook、会员凭证、邮箱恢复和客户管理页。未配置商户密钥时，会员页只显示“商户开通中”，不会建立付款。

## 建议路线

1. 先以香港服务器和独立 `.com` 域名上线国际网页版本。
2. 首个正式商户使用能够真实完成 KYC、收款和结算的司法辖区。若使用加拿大 Stripe，账户名称、地址、负责人及银行资料必须与加拿大个人或企业证明一致。
3. 完成测试模式全流程后才切换 Stripe 正式模式。
4. 中国大陆公开收费、营销或上架应用商店应作为单独合规项目，不与国际网页版本同时默认开启。

## 域名

当前技术首选是 `daofainsight.com`。最近一次注册局查询未发现该域名记录，但最终是否可购买及价格以阿里云结账页为准。

购买后配置：

- `A` 记录：主机记录 `@`，记录值 `47.86.31.98`
- `A` 记录：主机记录 `www`，记录值 `47.86.31.98`
- TTL：默认值即可
- Caddy 站点主机名：`daofainsight.com, www.daofainsight.com`
- `TIANJI_PUBLIC_ORIGIN=https://daofainsight.com`
- 更新所有 canonical、Open Graph、sitemap 和 Webhook 正式地址

阿里云官方域名注册入口与步骤：<https://help.aliyun.com/en/dws/getting-started/quickly-register-a-new-domain-name>

## Stripe 商户

建议如实填写：

- 产品类别：传统文化、自我观察及 AI 辅助文字解读的数字订阅软件
- 英文描述：`Bilingual traditional-culture, personal reflection and AI-assisted interpretation software. No guaranteed outcomes or professional advice.`
- 客服邮箱：`jackshu68@gmail.com`，域名邮箱启用后改为 `support@daofainsight.com`
- 账单描述符建议：`DAOFA`
- 月付：`DAOFA Pro Monthly`，`CA$9.99 CAD`，每月自动续订
- 年付：`DAOFA Pro Annual`，`CA$79 CAD`，每年自动续订

Stripe 后台完成：

1. 建立一个 Product 和两个 recurring Prices，复制两个 `price_...` 编号。
2. 开启 Customer Portal，允许取消订阅、更新付款方式及查看账单。
3. 建立 Webhook：`https://daofainsight.com/api/billing/webhook`。
4. 订阅事件：`checkout.session.completed`、`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.paid`、`invoice.payment_failed`。
5. 把正式密钥只放入服务器 `/etc/tianji-ai.env`，权限设为 `600`；网页和 Git 不得出现密钥。

Stripe 加拿大验证可能要求账户内企业名称和地址与注册资料完全一致：<https://support.stripe.com/questions/verification-requirements-canada>

## 上线前测试

- 测试月付成功、取消、失败卡和 3D Secure。
- 确认成功返回后 Pro 才生效，刷新及重开浏览器仍保持。
- 确认同一 Checkout 不能领取两次。
- 确认 Webhook 重送不会重复开通。
- 确认 Customer Portal 取消后，本期结束前仍可用，到期后失效。
- 确认 Brevo 恢复邮件送达 Gmail、QQ 邮箱和 Outlook，验证码十分钟过期。
- 确认账单、税费、自动续订、取消和退款文字在付款前可见。

## 中国大陆合规闸门

不能把“香港服务器可从大陆访问”理解为“可在大陆公开商业运营”。现行《互联网信息服务管理办法》区分经营性许可与非经营性备案，并禁止传播宣扬封建迷信的内容；生成式 AI 面向境内公众还涉及生成式 AI 规则、备案/登记适用性和 AI 生成内容标识。当前 AI 结果已在界面显著标明为 AI，但这不能替代完整法律审核。

因此，在取得中国互联网与内容合规律师的书面意见前：

- 不启用中国大陆定向广告、微信/支付宝收费或“预测保证”宣传。
- 不将产品提交中国大陆应用商店。
- 不使用治病、改命、保证姻缘、保证投资收益等表述。
- 大陆正式版单独评估经营主体、ICP/许可、公安备案、算法/大模型登记、内容标识、个人信息和支付商户要求。

官方依据：

- <https://xzfg.moj.gov.cn/front/law/detail?LawID=1756>
- <https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_483f0dd8eb1b4dc5961e4e008bd4a083.html>
- <https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm>
- <https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>

## 最后需要本人完成的资料

- 确认最终域名并支付域名订单。
- 在 Stripe 提交真实姓名/企业、地址、税务、证件和结算银行账户。
- 接受 Stripe 服务协议并完成可能出现的人脸或证件验证。
- 确认结账页显示的法定运营者、退款联系资料和币种无误。
