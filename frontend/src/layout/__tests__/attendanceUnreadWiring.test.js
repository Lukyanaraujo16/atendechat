/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";

const root = path.join(__dirname, "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

describe("wiring do badge de Atendimento", () => {
  it("provider monta uma vez no layout autenticado", () => {
    const layout = readSrc("layout/index.js");
    expect(layout).toContain("AttendanceUnreadProvider");
    expect(layout).toContain("<MainListItems");
  });

  it("MainListItems consome o contador e aplica o badge no ícone", () => {
    const menu = readSrc("layout/MainListItems.js");
    expect(menu).toContain("useAttendanceUnread");
    expect(menu).toContain("AttendanceUnreadMenuBadge");
    expect(menu).toContain("unreadConversationsCount");
    expect(menu).not.toContain("GlobalNotifications");
  });

  it("drawer desktop/recolhido/mobile compartilham MainListItems", () => {
    const layout = readSrc("layout/index.js");
    expect(layout).toContain("drawerVariant");
    expect(layout).toContain("MainListItems");
    expect((layout.match(/<MainListItems/g) || []).length).toBe(1);
  });

  it("consultas do badge enviam showAll=true e não replicam perfil no frontend", () => {
    const fetchSrc = readSrc("utils/attendanceUnreadCount.js");
    expect(fetchSrc).toContain("showAll: true");
    expect(fetchSrc).toMatch(/status,\s*withUnreadMessages: "true"/);
    const provider = readSrc(
      "context/AttendanceUnread/AttendanceUnreadProvider.js"
    );
    expect(provider).toContain("fetchAttendanceUnreadConversationsCount");
    expect(provider).not.toMatch(/profile\s*===\s*["']admin["']/);
    expect(provider).not.toMatch(/showAllTickets/);
  });
});
