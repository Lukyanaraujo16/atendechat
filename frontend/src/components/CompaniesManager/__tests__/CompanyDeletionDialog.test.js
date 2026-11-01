import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { changeLanguage } from "../../../translate/i18n";
import { DeleteCompanyDialog, useCompanyQuickActions } from "../CompanyActionDialogs";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

const mockRemove = jest.fn();
const mockStatus = jest.fn();
jest.mock("../../../hooks/useCompanies", () => () => ({
  update: jest.fn(),
  remove: (...a) => mockRemove(...a),
  fetchCompanyLogs: jest.fn(),
  fetchDeletionStatus: (...a) => mockStatus(...a),
}));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("../../CompanyFinanceSection/RenewSubscriptionDialog", () => () => null);

const row = { id: 7, name: "Empresa Alfa", status: true };

describe("Exclusão definitiva — diálogo", () => {
  beforeAll(() => changeLanguage("pt"));
  beforeEach(() => jest.clearAllMocks());

  it("exige o nome exato, avisa irreversível e envia o nome digitado", () => {
    const onConfirm = jest.fn();
    render(<DeleteCompanyDialog row={row} onClose={jest.fn()} onConfirm={onConfirm} loading={false} deletion={null} />);
    expect(screen.getByText(/Operação irreversível/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Excluir definitivamente" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nome da empresa para confirmar"), { target: { value: "Empresa alfa" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nome da empresa para confirmar"), { target: { value: "Empresa Alfa" } });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(row, "Empresa Alfa");
  });

  it("em andamento: sem novo envio; falha: mensagem e retomada", () => {
    const { rerender } = render(
      <DeleteCompanyDialog row={row} onClose={jest.fn()} onConfirm={jest.fn()} loading={false} deletion={{ status: "running" }} />
    );
    expect(screen.getByTestId("company-deletion-progress")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir definitivamente" })).not.toBeInTheDocument();
    rerender(
      <DeleteCompanyDialog
        row={row}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        loading={false}
        deletion={{ status: "failed", errorMessage: "Exclusão interrompida: pode ser retomada." }}
      />
    );
    expect(screen.getByTestId("company-deletion-failed")).toHaveTextContent("pode ser retomada");
    expect(screen.getByRole("button", { name: "Retomar exclusão" })).toBeInTheDocument();
  });

  it("acompanha a operação assíncrona até concluir e só então chama onDeleted", async () => {
    mockStatus.mockResolvedValueOnce(null).mockResolvedValue({ status: "completed" });
    mockRemove.mockResolvedValue({ deletion: { status: "pending" } });
    const onDeleted = jest.fn();
    let api;
    function Harness() {
      api = useCompanyQuickActions({ onDeleted });
      return api.dialogs;
    }
    render(<Harness />);
    await act(async () => {
      await api.actions.openDelete(row);
    });
    fireEvent.change(screen.getByLabelText("Nome da empresa para confirmar"), { target: { value: "Empresa Alfa" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(7, "Empresa Alfa"));
    expect(await screen.findByTestId("company-deletion-progress")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(row), { timeout: 4000 });
  });
});
