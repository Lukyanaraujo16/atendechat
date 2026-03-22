import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  LocalOffer,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const tagName = data?.tag?.name || data?.name || "Selecione tag";
  const tagColor = data?.tag?.color || data?.color || "#6366f1";

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        padding: "8px",
        borderRadius: "8px",
        boxShadow: "rgba(0, 0, 0, 0.05) 0px 3px 5px",
        border: "1px solid rgba(99, 102, 241, 0.25)",
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          background: "#6366f1",
          width: "18px",
          height: "18px",
          top: "20px",
          left: "-12px",
          cursor: "pointer",
        }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#ffff",
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
          sx={{ width: "12px", height: "12px", color: "#6366f1" }}
        />
        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={{ width: "12px", height: "12px", color: "#6366f1" }}
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
        <LocalOffer
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "4px",
            marginTop: "4px",
            color: "#6366f1",
          }}
        />
        <div style={{ color: "#232323", fontSize: "16px" }}>Tag Kanban</div>
      </div>
      <div style={{ color: "#232323", fontSize: "12px", width: 180 }}>
        <div
          style={{
            backgroundColor: `${tagColor}20`,
            color: tagColor,
            marginBottom: "3px",
            borderRadius: "5px",
            padding: "6px",
            fontWeight: 500,
          }}
        >
          {tagName}
        </div>
      </div>
      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#6366f1",
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
            color: "#ffff",
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
