# Ý tưởng ứng dụng LangGraph cho Nền tảng Product Owner - Software Agency

Tài liệu này tổng hợp các ý tưởng và cải tiến kỹ thuật sử dụng LangGraph để nâng cấp dự án, giúp hệ thống không chỉ dừng ở bước tìm kiếm mà còn trở thành một trợ lý ảo thông minh (Agentic Workflow).

---

## 1. Nâng cấp kỹ thuật cho Đồ thị Agent hiện tại (`search_agent`)

### Thêm tính năng "Nhớ" dài hạn (Checkpointer / Memory Persistence)
*   **Vấn đề:** Hiện tại, `search_agent` đang phải nhận lại toàn bộ mảng `messages` (lịch sử trò chuyện) từ frontend truyền lên cho mỗi lượt chat, khiến tốn payload mạng và khó quản lý nếu user bị ngắt kết nối.
*   **Giải pháp LangGraph:** Sử dụng cơ chế Checkpointing tích hợp sẵn của LangGraph (`MemorySaver` hoặc `MongoDBSaver/PostgresSaver`).
*   **Cách thức hoạt động:** Khi compile graph (`graph_builder.compile(checkpointer=...)`), bạn gán một `thread_id` duy nhất cho phiên chat. LangGraph sẽ tự động lưu lại toàn bộ snapshot của State. User có thể tắt trình duyệt, khi mở lại truyền đúng `thread_id`, Agent vẫn nhớ rõ tiến trình thu thập thông tin (ví dụ: đã thu thập tech stack nhưng còn thiếu budget) mà không cần truyền lại lịch sử thủ công.

### Cơ chế Human-in-the-loop (Chờ người dùng phê duyệt)
*   **Vấn đề:** Đôi khi bạn muốn AI thực hiện hành động (nhấn gửi email, tự động nhắn tin) nhưng cần sự đồng ý của con người để tránh rủi ro.
*   **Giải pháp LangGraph:** Gắn điểm dừng (interrupt) trước các Node thực thi hành động nhạy cảm.
*   **Use case:** Sau khi Agent tìm ra top 5 Agencies, thay vì tự động đi spam tin nhắn chào hàng thay mặt Product Owner, Graph sẽ dừng lại và chờ. Trên UI hiện nút "Duyệt gửi cấu hình yêu cầu". Khi User bấm duyệt, hệ thống gọi lại graph với lệnh `resume` để chạy tiếp Node gửi tin nhắn.

---

## 2. Các Bài Toán / Use-case mới tiềm năng

### A. Trợ lý Phân tích và Khởi tạo Yêu cầu (Project Brief / RFP Generator)
*   **Nhữ cảnh:** Product Owner (người thuê) thường bắt đầu với các ý tưởng rất sơ lược như: *"Tôi muốn một app giống Uber nhưng cho sinh viên đi nhờ xe"*. Với input này, việc tìm kiếm Agency sẽ thiếu chính xác do thiếu tham số kỹ thuật.
*   **Giải pháp LangGraph:** Xây dựng một luồng Agent đóng vai trò làm IT Business Analyst.
    *   **Node 1 (Tiếp nhận):** Đọc ý tưởng thô của người dùng.
    *   **Node 2 (Router):** Đánh giá xem thông tin đã đủ để lập đặc tả chưa.
    *   **Node 3 (Hỏi đáp):** Hỏi sâu thêm về các khía cạnh: Nền tảng (iOS/Android/Web)? Ngân sách dự kiến? Cổng thanh toán? Thời gian hoàn thành?
    *   **Node 4 (Document Generator):** Tổng hợp và tự động sinh ra một bản **RFP (Request for Proposal)** hoặc **PRD (Product Requirements Document)** thu gọn.
    *   **Node 5 (Execution):** Dùng chính bản PRD chuẩn chỉnh đó làm input cho phần Tìm kiếm Agency trong vector database.

### B. Tự động hóa Onboarding cho Agency (Profile Auto-generation)
*   **Ngữ cảnh:** Form tạo hồ sơ của Agency (`AgencyProfileForm`) yêu cầu nhập quá nhiều thông tin (budget range, team size, bio, case studies, tech stack), gây ra tỉ lệ drop-off (bỏ cuộc) cao khi Agency đăng ký.
*   **Giải pháp LangGraph:** Cho phép Agency upload file PDF hồ sơ năng lực (Company Profile) hoặc chỉ cần copy/paste URL website của công ty họ.
    *   **Quy trình Graph:** `Node Tải dữ liệu` ➔ `Node LLM đọc và trích xuất` ➔ `Node Phân loại (Domains, Tech Stack)` ➔ `Node Mapping (Chuẩn hóa thành Schema của ProfileService)`.
    *   **Trải nghiệm người dùng:** Agency upload PDF, chờ 10 giây, toàn bộ form trên UI tự động được điền đầy đủ. Họ chỉ cần rà soát lại và bấm "Xác nhận tạo Profile".

### C. Đánh giá và So sánh Chuyên sâu (Multi-Agent Agency Comparison)
*   **Ngữ cảnh:** Sau khi tìm được 3 Agencies phù hợp, User có thể phân vân không biết nên chọn ai cho dự án cụ thể này.
*   **Giải pháp LangGraph (Multi-Agent Architecture):**
    *   Nhận ID của 3 Agencies mà User đang cân nhắc cùng với Prompt chi tiết về bài toán của User.
    *   **Parallel Nodes:** Bắn ra 3 luồng (sub-graphs) chạy song song. Mỗi luồng đóng vai trò một "Giám khảo": soi kỹ Portfolio, Case Study cũ, và đánh giá Tech Stack của từng Agency xem có phù hợp với bài toán hay không.
    *   **Summary Node:** Thu thập kết quả từ 3 "Giám khảo", tổng hợp lại thành một bảng so sánh ĐIỂM MẠNH / ĐIỂM YẾU chuyên sâu. Ví dụ: *"Agency A rẻ hơn nhưng chủ yếu làm Outsource Web, Agency B đắt hơn nhưng có đúng kinh nghiệm làm App gọi xe như anh yêu cầu..."*

### D. Trợ lý Thông minh cho Nền tảng (Smart Chat Routing & Triage)
*   **Ngữ cảnh:** Hộp thoại Chat của toàn nền tảng cần phân loại được ý định của người dùng để trả lời tự động hoặc điều hướng chính xác.
*   **Giải pháp LangGraph:** 
    *   Node Classifier sẽ phân loại ý định:
        1. **Hỏi đáp chính sách:** Điều hướng vào `RAG Node` (đọc tài liệu FAQ, bảng giá dịch vụ).
        2. **Gặp lỗi thanh toán / Tài khoản:** Điều hướng vào `Human Handoff Node` (chuyển ticket cho nhân viên CSKH).
        3. **Tìm kiếm đối tác:** Kích hoạt luồng `search_agent` như đã có.
