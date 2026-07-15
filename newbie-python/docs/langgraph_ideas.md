# Kế Hoạch Nâng Cấp LangGraph Cho AI Connect

Tài liệu này mô tả 2 tính năng trọng tâm sẽ được triển khai để nâng cấp kiến trúc AI Agent (Sử dụng LangGraph) dựa trên dự án hiện tại.

## 1. Multi-Agent Router: Consult vs Search (Routing Sub-graphs Pattern)

**Vấn đề hiện tại:**
Toàn bộ flow của bạn mặc định user đã biết họ muốn làm gì (có budget, tech, domain). Nếu một ông Product Owner vào hỏi: _"Tôi muốn làm sàn thương mại điện tử nhỏ thì nên dùng React Native hay Flutter?"_ thì Agent hiện tại sẽ bị ép đi vào luồng extract filter và search DB, dẫn đến kết quả sai lệch hoặc luồng phản hồi không phù hợp.

**Giải pháp LangGraph:**

- Tạo một "Supervisor Agent" làm node đầu tiên (START).
- Supervisor sẽ định hướng (Routing thông qua Conditional Edge) sang 2 Sub-graph khác nhau:
  - **Nhánh 1:** Giao cho `ConsultantAgent` (có thể gắn thêm Web Search tool) để trò chuyện, phân tích công nghệ, ước tính ngân sách cho người dùng.
  - **Nhánh 2:** Giao cho agent tìm kiếm (`build_search_subgraph` trong `agent_graph.py`) khi user đã có ý định tìm công ty thật.

**Lợi ích:**
Giúp bạn làm quen và nắm vững cấu trúc Graph-in-Graph (Sub-graphs), một Design Pattern cực kỳ hữu ích và phổ biến để chia nhỏ và quản lý các hệ thống AI Agents lớn.

---

## 2. Interactive Filters trên UI (Time-Travel Pattern)

**Vấn đề hiện tại:**
Nếu `extractor_node` xử lý sai thông tin người dùng (Ví dụ: User nói "budget 10M VNĐ" nó lại hiểu là "10 triệu USD"), User hiện không có cách nào sửa lại trực tiếp mà phải chat bằng văn bản để yêu cầu AI sửa lại, điều này dễ làm đồ thị chat bị ngợp trong "chat history".

**Giải pháp LangGraph:**

- Bổ sung Frontend: Giao diện `ChatView.tsx` nhận được config JSON trả về (tech stack, budget...). Render JSON này thành các Filter Chips dán dưới khung message.
- Tương tác User: Nếu LLM extract sai, user có quyền **chỉnh sửa thẳng vào các JSON Filter chips đó** trên giao diện UI rồi ấn nút Confirm thay vì chat để yêu cầu.
- Xử lý Backend: Dưới Backend, dùng tính năng `update_state(config, {"budget": new_budget_from_ui}, as_node="extractor_node")` của Checkpointer (MongoDB). Thao tác này sẽ **ghi đè** lại State tại checkpoint trong quá khứ, sau đó Graph tiếp tục chạy (Resume) từ `router` với dữ liệu mới chuẩn xác từ người dùng.

**Lợi ích:**
Đây là tính năng quyền lực nhất của LangGraph – cho phép can thiệp thủ công (State Modification) và du hành vào quá khứ (Time-Travel). Giúp kết hợp chặt chẽ giữa UI Interactive và LLM State trơn tru và chuyên nghiệp nhất.
