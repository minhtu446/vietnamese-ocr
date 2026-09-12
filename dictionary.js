const DictCorrect = (() => {
  const COMMON = [
    "anh", "em", "tôi", "bạn", "chào", "xin", "cảm", "ơn", "không", "có",
    "một", "và", "những", "của", "được", "cho", "với", "khi", "đến", "nên",
    "làm", "đang", "mới", "còn", "nữa", "rồi", "thì", "này", "kia", "đó",
    "nào", "nhiều", "lắm", "rất", "quá", "thôi", "đi", "lại", "liền", "luôn",
    "người", "trời", "đất", "nước", "nhà", "cửa", "xe", "máy", "đường", "phố",
    "công", "việc", "học", "sinh", "giáo", "đoàn", "hội", "lớp", "trường", "bài",
    "ngày", "tháng", "năm", "giờ", "phút", "hôm", "mai", "qua", "nay", "sau",
    "trước", "trên", "dưới", "trong", "ngoài", "bên", "đây", "đấy", "kìa", "đa",
    "cần", "muốn", "phải", "nghĩ", "hiểu", "biết", "xem", "nghe", "nói", "viết",
    "đọc", "chạy", "bước", "đi", "ngồi", "đứng", "nằm", "ngủ", "dậy", "xong",
    "gửi", "nhận", "gọi", "mời", "tiếp", "chuyển", "lên", "xuống", "vào", "ra",
    "chữ", "tiếng", "ngôn", "nói", "đẹp", "xấu", "tốt", "hay", "giỏi", "kém",
    "lớn", "nhỏ", "dài", "ngắn", "cao", "thấp", "nặng", "nhẹ", "nhanh", "chậm",
    "trợ", "học", "thì", "và", "hoặc", "nhưng", "vì", "nếu", "để", "từ",
    "chỉ", "đã", "sẽ", "đang", "là", "ở", "tại", "cùng", "bởi", "do",
  ];

  function isSubstitutionTypo(a, b) {
    if (a.length !== b.length) return false;
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diffs++;
      if (diffs > 1) return false;
    }
    return diffs === 1;
  }

  function sameInitial(a, b) {
    if (a[0] === b[0]) return true;
    if ((a[0] === "đ" && b[0] === "d") || (a[0] === "d" && b[0] === "đ")) return true;
    return false;
  }

  function correct(text) {
    if (!text) return text;
    return text.replace(/[A-Za-zÀ-ỹĂÂĐÊÔƠƯạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđ]+/g, (word) => {
      const lower = word.toLowerCase();
      if (lower.length < 3 || lower.length > 12) return word;
      if (COMMON.indexOf(lower) !== -1) return word;
      let best = null;
      for (const cand of COMMON) {
        if (cand.length !== lower.length) continue;
        if (!sameInitial(cand, lower)) continue;
        if (!isSubstitutionTypo(lower, cand)) continue;
        if (!best || cand.length > best.length) best = cand;
      }
      if (!best) return word;
      const isUpper = word[0] === word[0].toUpperCase();
      if (isUpper) {
        return best.charAt(0).toUpperCase() + best.slice(1);
      }
      return best;
    });
  }

  return { correct };
})();