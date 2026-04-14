Mục đích thư mục contracts/

Đây là workspace riêng cho smart contract của BrainBattle.

Phần này chứa:
1. Solidity smart contracts
2. Hardhat config
3. Script deploy / cấu hình operator
4. Test contract
5. Artifacts/ABI để backend blockchain module sử dụng

Phạm vi hiện tại:
- Viết và test 2 contract chính:
  1. BrainPointToken
  2. BattleRewardRecorder

Flow mong muốn:
Backend battle/reward xử lý off-chain
-> tạo payload reward cuối cùng
-> gọi BattleRewardRecorder.recordBattleResult(...)
-> contract ghi nhận match, mint BP, emit event
-> backend lưu txHash / receiptStatus / resultHash