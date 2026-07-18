# 道法自然中国版商业上线清单

当前网站不收取会员费用，也不提供支付宝、微信支付、个人收款码或其他外部购买链接。计划中的 iOS 数字会员仅通过 Apple App 内购买（IAP）提供；是否获准销售及最终人民币价格以 Apple 审核和 App Store Connect 配置为准。

## 已确定的商业方案

- 免费版：`¥0`
- Pro 30 天：计划价 `¥39`，不自动续费
- Pro 365 天：计划价 `¥299`，不自动续费
- iOS 支付渠道：Apple App 内购买
- 网页支付：关闭
- StoreKit 产品编号：`com.daofainsight.pro.30days`、`com.daofainsight.pro.365days`

30 天与 365 天产品计划使用 Non-Renewing Subscription。它们不会自动续费，到期后恢复免费版，用户需要时在 App 内再次主动购买。

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

- 不启用中国大陆定向广告、公开大规模推广或付费按钮。
- 所有内容定位为传统文化研究、自我观察与娱乐参考。
- 不使用治病、改命、付费化解灾厄、保证姻缘、保证投资收益等话术。
- 对健康、法律、投资或人身安全事项明确要求以专业意见和现实证据为准。
- 不以虚假商品类目、借用商户号或个人收款码规避审核。
- 不把香港服务器可访问等同于大陆商业运营许可。
- 出生时间、姓名和地点按最小必要原则处理，默认保存在用户本机。

官方依据：

- <https://xzfg.moj.gov.cn/front/law/detail?LawID=1756>
- <https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm>
- <https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>

## 上线验收

- 网页没有支付宝、微信支付、收款码或外部数字会员购买链接。
- iOS 商品价格只取自 StoreKit，不在 App 内硬编码成交价。
- 购买成功必须依赖 Apple 签名交易验证，不能依赖前端“支付成功”页面。
- 重复交易不会重复开通；退款、撤销和到期会正确回收权益。
- “恢复购买”可在符合 Apple 规则的账户与装置环境中恢复权益。
- 隐私政策、服务条款和 App Store 隐私申报保持一致。
- AI 结果持续显示娱乐参考、非确定性预测和专业事项边界。
