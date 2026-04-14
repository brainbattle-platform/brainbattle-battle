Mục đích thư mục scripts/

Chứa các script hỗ trợ thao tác với contract trên local/testnet.

Các script chính:
1. deploy.ts
   - deploy BrainPointToken
   - deploy BattleRewardRecorder
   - cấu hình địa chỉ phụ thuộc giữa các contract

2. set-operator.ts
   - cập nhật operator backend wallet
   - dùng sau deploy hoặc khi đổi service wallet

3. verify.ts
   - verify source code contract trên explorer (nếu deploy testnet public)

Các script này không phải runtime backend.
Chúng chỉ phục vụ devops / setup môi trường chain.