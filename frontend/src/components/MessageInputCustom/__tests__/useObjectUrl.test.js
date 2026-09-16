/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import useObjectUrl from "../useObjectUrl";

function Probe({ blob }) {
  const url = useObjectUrl(blob);
  return <span data-testid="object-url">{url}</span>;
}

describe("useObjectUrl", () => {
  let createObjectURL;
  let revokeObjectURL;

  beforeEach(() => {
    createObjectURL = jest.fn(() => "blob:preview-test");
    revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
  });

  it("cria object URL e revoga no unmount", () => {
    const file = new File(["x"], "foto.png", { type: "image/png" });
    const { unmount } = render(<Probe blob={file} />);
    expect(screen.getByTestId("object-url").textContent).toBe("blob:preview-test");
    expect(createObjectURL).toHaveBeenCalledWith(file);
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-test");
  });

  it("revoga ao trocar o arquivo", () => {
    const first = new File(["a"], "a.png", { type: "image/png" });
    const second = new File(["b"], "b.png", { type: "image/png" });
    createObjectURL
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const { rerender } = render(<Probe blob={first} />);
    rerender(<Probe blob={second} />);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
    expect(screen.getByTestId("object-url").textContent).toBe("blob:second");
  });

  it("revoga ao limpar o blob", () => {
    const file = new File(["x"], "foto.png", { type: "image/png" });
    const { rerender } = render(<Probe blob={file} />);
    rerender(<Probe blob={null} />);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-test");
    expect(screen.getByTestId("object-url").textContent).toBe("");
  });
});
