# 道法自然中国版商业上线清单

网站已实现手机号账户、匿名一天基础体验、新注册账号三天完整功能、免费版权限、人工核验订单和会员有效期。三天欢迎权限由服务器静默写入并自动到期，不在前端作为营销承诺展示。支付码只有在站主通过受保护接口上传后才会显示；当前不得上传或启用个人收款码。公开收费前应改用支付机构提供的合规商户收款码，并完成适用于经营主体、网站和内容的登记、备案或许可评估。

## 已确定的商业方案

- 免费版：`¥0`
- Pro 30 天：计划价 `¥39`，不自动续费
- Pro 365 天：计划价 `¥299`，不自动续费
- 网页支付：预备人工核验，合规商户收款码配置前保持关闭
- iOS 支付渠道：如上架 App，数字会员仅使用 Apple App 内购买
- StoreKit 产品编号：`com.daofainsight.pro.30days`、`com.daofainsight.pro.365days`

网页方案不会自动续费，到期后恢复免费版。未来 iOS 版的 30 天与 365 天产品计划使用 Non-Renewing Subscription，并与网页支付入口完全分离。

## 网页人工核验

已实现的技术流程：用户登录手机号账户，选择方案和支付渠道，在支付应用内付款，提交交易单号；只有服务器识别的站主账号可以查看申请并在实际核对到账后批准。批准动作由服务器写入 30 天或 365 天有效期，交易单号不能重复使用，前端不能自行改成会员。

技术实现不代表支付与经营资质已经满足。中国人民银行关于收款码管理的通知明确区分个人收款码与有明显经营活动的收款人，并要求支付服务机构为经营活动提供特约商户收款码。因此，本项目不得把个人收款码用于持续会员收费，也不得以“内测”“发烧友”作为规避支付或互联网经营规则的依据。

官方依据：

- <https://big5.www.gov.cn/gate/big5/www.gov.cn/zhengce/zhengceku/2022-02/25/content_5675558.htm>
- <https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_483f0dd8eb1b4dc5961e4e008bd4a083.html>
- <https://qhca.miit.gov.cn/zwgk/dxgl/dxfw/art/2020/art_cb5b36103a2c47d6bd048063aa732453.html>

## 正式域名

`daofainsight.com` 已注册，阿里云信息模板实名认证成功，域名本身仍需等待注册局审核完成。DNS 已预先配置：

- `A` 记录：主机记录 `@`，记录值 `47.86.31.98`
- `A` 记录：主机记录 `www`，记录值 `47.86.31.98`
- Caddy 主机名：`daofainsight.com, www.daofainsight.com`
- `TIANJI_PUBLIC_ORIGIN=https://daofainsight.com`
- 旧 `tianji.47-86-31-98.sslip.io` 地址暂作兼容入口

香港服务器可供大陆访问，但不等于已具备大陆公开经营、内容或付费合规资格。

## Apple App 内购买

Apple App Review Guidelines 3.1.1 要求：在 App 内解锁数字功能、会员、订阅或高级内容，应使用 App 内购买。中国区没有美国商店现行的外部购买链接例外，因此 iOS App 内不得放置支付宝、微信支付、收款码或引导用户到网页购买数字会员的按钮和文案。

接入前需要：

1. 加入 Apple Developer Program，并在 App Store Connect 建立应用记录。
2. 签署付费应用协议，完成银行与税务资料。
3. 创建两个 Non-Renewing Subscription 产品并配置中国区人民币价格。
4. 使用 StoreKit 2 完成购买、交易验证、到期判断与“恢复购买”。
5. 服务端验证 Apple 签名交易，不信任前端传来的价格、商品编号或成功状态。
6. 在沙箱和 TestFlight 完成购买、重复购买、换机恢复、退款和撤销权益测试。
7. App 内不得出现外部支付 CTA；最终展示价格必须以 StoreKit 返回值为准。

官方资料：

- <https://developer.apple.com/app-store/review/guidelines/>
- <https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types/>
- <https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/generate-keys-for-in-app-purchases/>

## 中国大陆合规闸门

产品包含八字、紫微、奇门、塔罗等传统文化和 AI 解读内容。支付合规、Apple 审核、域名实名认证、ICP备案/许可、应用备案、内容合规和个人信息保护是不同事项；完成其中一项不代表整体已经合法上线。

在取得适合本项目的书面专业意见前：

- 不启用中国大陆定向广告、公开大规模推广或实际付费按钮。
- 所有内容定位为传统文化研究、自我观察与娱乐参考。
- 不使用治病、改命、付费化解灾厄、保证姻缘、保证投资收益等话术。
- 对健康、法律、投资或人身安全事项明确要求以专业意见和现实证据为准。
- 不以虚假商品类目、借用商户号或个人收款码规避审核；收款主体、网站主体和服务名称应保持一致。
- 不把香港服务器可访问等同于大陆商业运营许可。
- 出生时间、姓名和地点按最小必要原则处理，默认保存在用户本机。

官方依据：

- <https://xzfg.moj.gov.cn/front/law/detail?LawID=1756>
- <https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm>
- <https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>

## 上线验收

- 网页在未配置合规商户收款码时明确显示通道未开放，不能提交订单。
- 收款码不进入 Git 仓库，只能由站主登录后上传，并只向已登录用户通过禁止缓存的接口提供。
- 会员申请必须由站主核对实际到账后批准；交易单号重复、金额不符或未到账时不得开通。
- 站主手机号由服务器环境变量识别，永久免会员费用；其他账户不能通过前端声明站主身份。
- iOS 商品价格只取自 StoreKit，不在 App 内硬编码成交价。
- 购买成功必须依赖 Apple 签名交易验证，不能依赖前端“支付成功”页面。
- 重复交易不会重复开通；退款、撤销和到期会正确回收权益。
- “恢复购买”可在符合 Apple 规则的账户与装置环境中恢复权益。
- 隐私政策、服务条款和 App Store 隐私申报保持一致。
- AI 结果持续显示娱乐参考、非确定性预测和专业事项边界。
