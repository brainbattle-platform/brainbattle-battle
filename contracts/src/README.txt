Mục đích thư mục src/

Chứa mã nguồn Solidity của smart contract.

Các contract chính:
1. BrainPointToken.sol
   - Token BrainPoint (BP)
   - dùng để mint reward cho người chơi

2. BattleRewardRecorder.sol
   - Ghi nhận kết quả battle tối thiểu
   - Chống ghi trùng matchId
   - Mint BP cho người chơi
   - Emit event để truy vết reward breakdown

Lưu ý:
- Không đưa gameplay logic vào contract
- Không tính score hoặc anti-farm trên chain
- Chỉ nhận kết quả cuối cùng từ backend