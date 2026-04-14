Mục đích thư mục test/

Chứa unit test cho smart contract.

Mục tiêu:
- kiểm tra logic contract đúng trước khi nối backend
- phát hiện lỗi sớm
- tạo bằng chứng kỹ thuật để báo cáo giảng viên

Nguyên tắc:
- test contract độc lập với core battle
- dùng payload mock
- tập trung vào success case + revert case + event + balance