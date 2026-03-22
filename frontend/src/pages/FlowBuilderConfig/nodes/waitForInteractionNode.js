import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  HourglassEmpty,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();

  return (
    <div
      style={{
        backgroundColor: "#faf5ff",
        padding: "8px",
        borderRadius: "8px",
        boxShadow: "rgba(0, 0, 0, 0.05) 0px 3px 5px",
        border: "1px solid rgba(139, 92, 246, 0.25)",
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          background: "#8b5cf6",
          width: "18px",
          height: "18px",
          top: "20px",
          left: "-12px",
          cursor: "pointer",
        }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#fff",
            width: "10px",
            height: "10px",
            marginLeft: "2.9px",
            marginBottom: "1px",
            pointerEvents: "none",
          }}
        />
      </Handle>
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 5,
          top: 5,
          cursor: "pointer",
          gap: 6,
        }}
      >
        <ContentCopy
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
          sx={{ width: "12px", height: "12px", color: "#8b5cf6" }}
        />
        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{ width: "12px", height: "12px", color: "#8b5cf6" }}
        />
      </div>
      <div
        style={{
          color: "#232323",
          fontSize: "16px",
          flexDirection: "row",
          display: "flex",
        }}
      >
        <HourglassEmpty
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "4px",
            marginTop: "4px",
            color: "#8b5cf6",
          }}
        />
        <div style={{ color: "#232323", fontSize: "16px" }}>
          Aguardar Interação
        </div>
      </div>
      <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
        Pausa o fluxo até o cliente enviar nova mensagem
      </div>
      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#8b5cf6",
          width: "18px",
          height: "18px",
          top: "70%",
          right: "-11px",
          cursor: "pointer",
        }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#fff",
            width: "10px",
            height: "10px",
            marginLeft: "2.9px",
            marginBottom: "1px",
            pointerEvents: "none",
          }}
        />
      </Handle>
    </div>
  );
});
