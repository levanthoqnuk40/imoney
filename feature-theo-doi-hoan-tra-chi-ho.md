# Đặc tả tính năng theo dõi hoàn trả chi hộ trong app quản lý tài chính

## Mục tiêu tính năng

Tính năng này dùng để giải quyết bài toán người dùng đại diện trả tiền cho một nhóm khi đi ăn, đi chơi, du lịch hoặc mua chung, sau đó từng người trong nhóm sẽ chuyển khoản trả lại. Hệ thống cần giúp người dùng biết rõ ai đã trả, ai chưa trả, ai mới trả một phần và tổng cộng còn phải thu bao nhiêu từ mỗi sự kiện chi hộ.

Tính năng không được xem toàn bộ số tiền đã ứng trước là chi tiêu cá nhân thực sự. Cần tách riêng phần tiền người dùng tự chi cho bản thân và phần tiền người dùng đang tạm ứng hộ người khác để tránh sai báo cáo thu chi tháng.

## Bài toán nghiệp vụ cần giải

Ví dụ thực tế:
- Người dùng đi ăn 4 người.
- Tổng hóa đơn là 1.200.000đ.
- Người dùng là người thanh toán toàn bộ.
- Mỗi người chia đều 300.000đ.
- Phần thực chi của người dùng là 300.000đ.
- Phần 900.000đ còn lại là khoản phải thu từ 3 người còn lại.

Hệ thống phải hỗ trợ:
- Tạo một sự kiện chi hộ theo từng bữa ăn hoặc buổi đi chơi.
- Khai báo danh sách người tham gia.
- Tính phần tiền phải trả của từng người.
- Ghi nhận nhiều lần hoàn trả cho cùng một người.
- Tự động xác định trạng thái: chưa trả, trả một phần, đã trả đủ.
- Hiển thị danh sách các khoản còn phải thu để người dùng không quên.
- Không ghi nhận tiền bạn bè trả lại là thu nhập.

## Phạm vi tính năng

Tính năng này nên được xây dưới dạng một module riêng, ví dụ tên module:
- Theo dõi chi hộ
- Nhóm hoàn trả
- Khoản phải thu từ bạn bè
- Ứng trước cho nhóm

Nên coi mỗi lần trả hộ là một `Expense Event` hoặc `Repayment Tracking Event` riêng biệt.

## Khái niệm dữ liệu chính

### 1. Expense Event
Đây là bản ghi header đại diện cho một lần người dùng trả tiền thay cho nhóm.

Thông tin cần có:
- `EventId`
- `Title`: tên sự kiện, ví dụ `Ăn lẩu cuối tuần`, `Cafe team`, `Đi biển Quy Nhơn`
- `EventDate`
- `TotalAmount`
- `Currency` nếu app có đa tiền tệ
- `PaidByUserId`: người thanh toán, trong bài toán này thường là chủ app
- `Description`
- `ReceiptImageUrl` hoặc đường dẫn ảnh hóa đơn
- `Location` nếu cần
- `SplitMethod`: chia đều, chia tay, theo phần trăm, theo suất
- `DueDate`: hạn dự kiến mọi người hoàn trả
- `Status`: Open, Partial, Settled, Cancelled
- `CreatedAt`
- `UpdatedAt`

### 2. Expense Participant
Danh sách những người tham gia vào event.

Thông tin cần có:
- `ParticipantId`
- `EventId`
- `PersonId` nếu có danh bạ nội bộ
- `DisplayName`
- `PhoneNumber` hoặc `BankHint` nếu muốn hỗ trợ nhắc nợ
- `IsOwner`: có phải là người dùng hiện tại không
- `Note`

### 3. Expense Split
Bản ghi thể hiện mỗi người phải chịu bao nhiêu tiền trong event.

Thông tin cần có:
- `SplitId`
- `EventId`
- `ParticipantId`
- `AmountDue`
- `AmountActualPaid`: số thực tế participant đã thanh toán ở quầy, nếu có tình huống nhiều người cùng thanh toán
- `AmountReceivable`: số cần thu về từ participant
- `SplitRatio` nếu chia theo tỷ lệ
- `IsExcluded`: có bị loại khỏi bill không
- `Note`

### 4. Repayment
Bản ghi nhận từng lần chuyển khoản trả lại.

Thông tin cần có:
- `RepaymentId`
- `EventId`
- `ParticipantId`
- `RepaymentDate`
- `Amount`
- `PaymentMethod`: tiền mặt, chuyển khoản, ví điện tử
- `ReferenceNo`: mã giao dịch nếu có
- `Note`
- `CreatedAt`

### 5. Computed Settlement State
Không nhất thiết là bảng vật lý, có thể là view hoặc dữ liệu tính runtime.

Thông tin cần tính cho từng người:
- `AmountDue`
- `AmountPaid`
- `AmountRemaining`
- `SettlementStatus`

Quy tắc:
- `AmountPaid = SUM(Repayment.Amount)` theo `EventId` và `ParticipantId`
- `AmountRemaining = AmountDue - AmountPaid`
- `SettlementStatus = Unpaid` nếu `AmountPaid = 0`
- `SettlementStatus = Partial` nếu `0 < AmountPaid < AmountDue`
- `SettlementStatus = Paid` nếu `AmountPaid >= AmountDue`

## Nguyên tắc hạch toán tài chính

Đây là phần cực kỳ quan trọng.

Khi người dùng trả hộ cả nhóm, hệ thống phải tách thành hai phần:

### Phần 1: Chi tiêu thực của bản thân người dùng
Đây mới là khoản được tính vào báo cáo chi tiêu cá nhân.

### Phần 2: Khoản phải thu từ người khác
Đây không phải chi tiêu cuối cùng và cũng không phải thu nhập khi thu hồi lại.

Ví dụ:
- Tổng bill: 1.200.000đ
- Người dùng chịu phần mình: 300.000đ
- Còn phải thu từ người khác: 900.000đ

Bút toán logic nội bộ nên hiểu như sau:
- Ghi nhận `PersonalExpense = 300.000đ`
- Ghi nhận `ReceivableFromFriends = 900.000đ`
- Khi bạn bè trả lại 900.000đ thì giảm `ReceivableFromFriends`
- Không ghi nhận 900.000đ này vào `Income`

Nếu app đang có dashboard tổng thu và tổng chi theo tháng, cần đảm bảo logic này không làm tăng ảo cả thu và chi.

## Luồng nghiệp vụ chuẩn

### Luồng 1: Tạo event chi hộ
1. Người dùng chọn chức năng `Tạo khoản chi hộ`.
2. Nhập tiêu đề sự kiện.
3. Nhập ngày, tổng tiền, mô tả, ảnh hóa đơn nếu có.
4. Chọn những người tham gia.
5. Chọn cách chia tiền.
6. Hệ thống sinh ra các bản ghi split.
7. Hệ thống tính phần nào là chi tiêu cá nhân, phần nào là phải thu.
8. Event ở trạng thái `Open` hoặc `Partial` tùy theo có ai trả ngay tại thời điểm tạo không.

### Luồng 2: Ghi nhận hoàn trả
1. Người dùng mở event đã tạo.
2. Chọn người đã chuyển khoản.
3. Nhập số tiền họ vừa trả.
4. Chọn ngày trả, phương thức trả, ghi chú.
5. Hệ thống tạo bản ghi `Repayment`.
6. Hệ thống tính lại `AmountPaid`, `AmountRemaining`, `SettlementStatus` của người đó.
7. Nếu toàn bộ participant đã trả đủ thì event chuyển sang `Settled`.

### Luồng 3: Hoàn trả nhiều lần
Hệ thống phải cho phép một người trả nhiều lần.

Ví dụ:
- Người A nợ 300.000đ
- Lần 1 trả 100.000đ
- Lần 2 trả 200.000đ
- Tổng trả 300.000đ => trạng thái `Paid`

### Luồng 4: Chỉnh sửa hoặc hủy event
Khi sửa tổng bill, thêm bớt người tham gia hoặc đổi cách chia tiền, hệ thống phải:
- Tính lại split
- Giữ lịch sử repayment đã có
- Cảnh báo nếu số tiền đã trả vượt quá số mới phải trả
- Đánh dấu trạng thái bất thường nếu phát sinh overpaid

## Cách chia tiền cần hỗ trợ

### Mức tối thiểu cần có cho MVP
- Chia đều cho tất cả người tham gia
- Cho phép loại trừ một người khỏi bill
- Cho phép sửa tay số tiền từng người

### Mức nâng cao
- Chia theo tỷ lệ phần trăm
- Chia theo số suất
- Chia theo item món ăn

Đề xuất MVP chỉ cần:
- Chia đều
- Chỉnh tay từng người

## Màn hình cần xây

### 1. Danh sách event chi hộ
Mục tiêu: giúp người dùng nhìn nhanh các khoản đang chờ thu.

Thông tin mỗi item nên hiển thị:
- Tên sự kiện
- Ngày
- Tổng tiền
- Số người tham gia
- Đã thu / còn phải thu
- Số người đã trả / chưa trả
- Trạng thái
- Badge quá hạn nếu đã quá due date

Nên có các tab hoặc filter:
- `Đang chờ thu`
- `Đã thu đủ`
- `Quá hạn`
- `Tất cả`

### 2. Màn hình tạo / sửa event
Trường nhập liệu nên có:
- Tên sự kiện
- Ngày
- Tổng tiền
- Danh sách người tham gia
- Cách chia tiền
- Hạn thanh toán
- Ghi chú
- Ảnh hóa đơn

### 3. Màn hình chi tiết event
Phải thể hiện rõ 3 vùng:

#### Thông tin tổng quan
- Tên event
- Tổng bill
- Phần của bản thân người dùng
- Tổng còn phải thu
- Trạng thái chung

#### Danh sách participant
Mỗi participant hiển thị:
- Tên
- Phải trả bao nhiêu
- Đã trả bao nhiêu
- Còn bao nhiêu
- Trạng thái: Chưa trả / Trả một phần / Đã trả
- Nút `Ghi nhận hoàn trả`

#### Lịch sử hoàn trả
Hiển thị timeline các lần thanh toán:
- Ai trả
- Ngày giờ
- Số tiền
- Hình thức thanh toán
- Ghi chú

### 4. Dashboard nhắc nợ
Ở dashboard chính của app nên có widget riêng:
- `Tổng còn phải thu từ bạn bè`
- `Số event chưa chốt`
- `Khoản quá hạn gần nhất`
- `Top người còn nợ`

## Quy tắc giao diện và UX

Mục tiêu UX là chống quên và scan nhanh.

Yêu cầu:
- Event chưa thu đủ phải luôn dễ thấy hơn giao dịch bình thường.
- Dùng màu trạng thái rõ ràng: xám cho chưa trả, cam cho trả một phần, xanh cho đã trả, đỏ cho quá hạn.
- Mỗi event phải hiển thị tiến độ kiểu `3/5 người đã trả`.
- Có thể dùng progress bar cho tỷ lệ số tiền đã thu.
- Nút `Ghi nhận hoàn trả` phải đặt ở vị trí dễ thao tác.
- Trên mobile, danh sách participant phải ưu tiên đọc nhanh hơn là nhồi quá nhiều thông tin.
- Có sticky filter hoặc tab nhanh để lọc event còn mở.

## Nhắc nhở và tự động hóa

Nên hỗ trợ các cơ chế sau:
- Nhắc sau X ngày nếu event chưa thu đủ
- Cảnh báo event sắp quá hạn
- Cảnh báo participant còn nợ nhiều nhất
- Gợi ý nội dung nhắn tin nhắc nợ

Ví dụ nội dung gợi ý:
- `Hôm trước ăn lẩu cuối tuần, phần của bạn còn 300.000đ nhé.`
- `Event Cafe team ngày 02/06, bạn còn thiếu 120.000đ.`

Nếu app có notification system thì nên tạo nhắc việc nội bộ. Nếu chưa có notification thì ít nhất phải có dashboard card nổi bật.

## Validation và business rules

### Validation khi tạo event
- Tổng tiền phải lớn hơn 0
- Phải có ít nhất 1 participant
- Nếu chia tay thì tổng các phần phải bằng tổng tiền
- Không được tạo repayment âm hoặc bằng 0

### Validation khi ghi nhận repayment
- Số tiền repayment phải lớn hơn 0
- Không được vượt quá phần còn lại nếu app không cho phép overpaid
- Nếu cho phép overpaid thì phải đánh dấu và cảnh báo rõ
- Participant phải thuộc event

### Business rules
- Người dùng hiện tại có thể là một participant trong event
- Có thể có event mà người dùng không tính phần mình, ví dụ chỉ đứng ra trả hộ hoàn toàn
- Event chỉ được `Settled` khi mọi participant đã thanh toán đủ
- Khoản hoàn trả không được tính vào income report
- Phần trả hộ không được tính toàn bộ vào expense report

## Gợi ý database schema

```sql
CREATE TABLE ExpenseEvents (
    EventId UNIQUEIDENTIFIER PRIMARY KEY,
    Title NVARCHAR(200) NOT NULL,
    EventDate DATETIME NOT NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,
    SplitMethod NVARCHAR(50) NOT NULL,
    DueDate DATETIME NULL,
    Description NVARCHAR(1000) NULL,
    ReceiptImageUrl NVARCHAR(500) NULL,
    Status NVARCHAR(30) NOT NULL,
    CreatedAt DATETIME NOT NULL,
    UpdatedAt DATETIME NOT NULL
);

CREATE TABLE ExpenseParticipants (
    ParticipantId UNIQUEIDENTIFIER PRIMARY KEY,
    EventId UNIQUEIDENTIFIER NOT NULL,
    DisplayName NVARCHAR(150) NOT NULL,
    PhoneNumber NVARCHAR(50) NULL,
    IsOwner BIT NOT NULL DEFAULT 0,
    Note NVARCHAR(500) NULL
);

CREATE TABLE ExpenseSplits (
    SplitId UNIQUEIDENTIFIER PRIMARY KEY,
    EventId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NOT NULL,
    AmountDue DECIMAL(18,2) NOT NULL,
    SplitRatio DECIMAL(18,4) NULL,
    IsExcluded BIT NOT NULL DEFAULT 0,
    Note NVARCHAR(500) NULL
);

CREATE TABLE Repayments (
    RepaymentId UNIQUEIDENTIFIER PRIMARY KEY,
    EventId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NOT NULL,
    RepaymentDate DATETIME NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod NVARCHAR(50) NULL,
    ReferenceNo NVARCHAR(100) NULL,
    Note NVARCHAR(500) NULL,
    CreatedAt DATETIME NOT NULL
);
```

## Gợi ý view/query tính trạng thái

```sql
SELECT 
    s.EventId,
    s.ParticipantId,
    s.AmountDue,
    ISNULL(SUM(r.Amount), 0) AS AmountPaid,
    s.AmountDue - ISNULL(SUM(r.Amount), 0) AS AmountRemaining,
    CASE 
        WHEN ISNULL(SUM(r.Amount), 0) <= 0 THEN 'Unpaid'
        WHEN ISNULL(SUM(r.Amount), 0) < s.AmountDue THEN 'Partial'
        ELSE 'Paid'
    END AS SettlementStatus
FROM ExpenseSplits s
LEFT JOIN Repayments r 
    ON r.EventId = s.EventId 
   AND r.ParticipantId = s.ParticipantId
WHERE ISNULL(s.IsExcluded, 0) = 0
GROUP BY s.EventId, s.ParticipantId, s.AmountDue;
```

## API hoặc service layer gợi ý

Nếu app có backend/service layer, nên có các hàm sau:
- `CreateExpenseEvent(request)`
- `UpdateExpenseEvent(request)`
- `GetExpenseEventById(eventId)`
- `GetOpenExpenseEvents(filter)`
- `AddRepayment(request)`
- `UpdateRepayment(request)`
- `DeleteRepayment(repaymentId)`
- `CalculateSettlement(eventId)`
- `CloseEventIfSettled(eventId)`

## Domain model / class gợi ý

```csharp
public class ExpenseEvent
{
    public Guid EventId { get; set; }
    public string Title { get; set; }
    public DateTime EventDate { get; set; }
    public decimal TotalAmount { get; set; }
    public string SplitMethod { get; set; }
    public DateTime? DueDate { get; set; }
    public string Description { get; set; }
    public string Status { get; set; }
    public List<ExpenseParticipant> Participants { get; set; }
    public List<ExpenseSplit> Splits { get; set; }
    public List<Repayment> Repayments { get; set; }
}

public class ExpenseParticipant
{
    public Guid ParticipantId { get; set; }
    public Guid EventId { get; set; }
    public string DisplayName { get; set; }
    public bool IsOwner { get; set; }
}

public class ExpenseSplit
{
    public Guid SplitId { get; set; }
    public Guid EventId { get; set; }
    public Guid ParticipantId { get; set; }
    public decimal AmountDue { get; set; }
}

public class Repayment
{
    public Guid RepaymentId { get; set; }
    public Guid EventId { get; set; }
    public Guid ParticipantId { get; set; }
    public DateTime RepaymentDate { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; }
    public string Note { get; set; }
}
```

## Yêu cầu cho AI khi implement

Hãy implement tính năng này theo các nguyên tắc sau:

### Về nghiệp vụ
- Không coi toàn bộ số tiền người dùng trả hộ là chi tiêu cá nhân.
- Tự động tách phần chi thực của người dùng và phần phải thu từ người khác.
- Khoản tiền người khác hoàn trả không được tính là thu nhập.
- Hỗ trợ hoàn trả nhiều lần cho cùng một participant.
- Tự động cập nhật trạng thái participant và trạng thái event.

### Về dữ liệu
- Thiết kế entity, bảng dữ liệu và query theo hướng dễ mở rộng.
- Hỗ trợ thêm ảnh hóa đơn, ghi chú, due date, payment method.
- Có thể xây computed field, view hoặc service để tính `AmountRemaining` và `SettlementStatus`.

### Về giao diện
- Tạo màn danh sách event chi hộ.
- Tạo form thêm/sửa event.
- Tạo màn chi tiết event với participant list và repayment history.
- Tạo widget/dashboard để nhắc các khoản chưa thu xong.
- Ưu tiên UX mobile, đọc nhanh, ít thao tác, chống quên.

### Về kỹ thuật
- Viết code sạch, dễ maintain.
- Tách rõ domain model, service xử lý nghiệp vụ, repository/database access và UI layer.
- Tránh hard-code trạng thái, nên dùng enum hoặc constant.
- Có test cho các case tính toán chính.

## Test cases bắt buộc

### Case 1: Chia đều và mọi người trả đủ
- Tổng bill: 1.200.000đ
- 4 người
- Mỗi người 300.000đ
- 3 người còn lại trả đủ
- Event phải về `Settled`

### Case 2: Một người trả nhiều lần
- A nợ 300.000đ
- Trả 100.000đ
- Trả tiếp 200.000đ
- Trạng thái phải chuyển từ `Partial` sang `Paid`

### Case 3: Có người chưa trả
- Event phải ở trạng thái `Open` hoặc `Partial`
- Dashboard vẫn phải hiện trong danh sách cần theo dõi

### Case 4: Không tính sai vào báo cáo tài chính
- Chỉ phần của owner được ghi vào chi tiêu cá nhân
- Phần người khác trả lại không được cộng vào thu nhập

### Case 5: Chỉnh sửa event sau khi đã có repayment
- Hệ thống phải tính lại trạng thái
- Cảnh báo nếu repayment hiện tại lớn hơn amount due mới

## Đề xuất thứ tự triển khai

### Phase 1 - MVP
- Tạo event chi hộ
- Chia đều
- Danh sách participant
- Ghi nhận hoàn trả
- Tính trạng thái đã trả/chưa trả
- Dashboard khoản còn phải thu

### Phase 2
- Chỉnh tay số tiền từng người
- Due date và quá hạn
- Ảnh hóa đơn
- Filter theo trạng thái
- Reminder nội bộ

### Phase 3
- Chia theo phần trăm hoặc item
- Gợi ý nội dung nhắc nợ
- Thống kê bạn bè thường xuyên nợ/hoàn trả
- Tích hợp gửi nhắc qua app khác nếu cần

## Kết quả mong muốn sau khi hoàn thiện

Sau khi hoàn thiện tính năng, người dùng có thể:
- Biết chính xác event nào còn mở.
- Biết chính xác ai chưa trả, ai trả thiếu, ai trả đủ.
- Không bị sai báo cáo thu chi cá nhân.
- Không quên các khoản đã chi hộ cho bạn bè.
- Theo dõi hoàn trả rõ ràng ngay trên mobile app.

## Yêu cầu đầu ra khi AI code

AI cần trả ra:
- Thiết kế database hoặc migration script
- Entity/model
- Service xử lý nghiệp vụ
- Query hoặc repository tính trạng thái công nợ
- UI màn danh sách, tạo event, chi tiết event
- Các test case xử lý nghiệp vụ quan trọng

## Ghi chú cuối

Ưu tiên hoàn thiện nghiệp vụ đúng trước, sau đó mới tối ưu UI. Mục tiêu chính của tính năng này là theo dõi khoản phải thu từ các lần người dùng đại diện trả tiền cho nhóm, giúp tránh quên và tránh sai lệch số liệu tài chính cá nhân.
