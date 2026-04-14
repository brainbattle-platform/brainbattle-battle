Mục đích module blockchain trong NestJS

Đây là lớp integration giữa backend BrainBattle và smart contract.

Nhiệm vụ:
- nhận payload reward cuối cùng từ backend
- chuẩn hóa payload
- tính resultHash
- gọi smart contract BattleRewardRecorder
- đọc tx receipt / event
- trả về txHash, status, recordedAt
- sau này lưu OnchainRecord vào DB

Module này KHÔNG:
- tính gameplay
- tính score
- tính anti-farm
- quyết định reward rules

Phần đó thuộc core battle/reward off-chain.