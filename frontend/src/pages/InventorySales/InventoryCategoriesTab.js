import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import {
  AppEmptyState,
  AppLoadingState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppSectionCard,
  AppTableContainer,
  AppTableRowSkeleton,
  MobileCardList,
  MobileEntityCard,
} from "../../ui";
import {
  deleteInventoryCategory,
  listInventoryCategories,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import CategoryFormDialog from "./CategoryFormDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import { toast } from "react-toastify";
import { useInventoryPermissions } from "../../utils/inventoryAccess";

const useStyles = makeStyles((theme) => ({
  headerRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
}));

export default function InventoryCategoriesTab() {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await listInventoryCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const parentName = (cat) => {
    if (!cat.parentId) return "—";
    const parent = categories.find((c) => c.id === cat.parentId);
    return parent?.name || cat.parent?.name || "—";
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInventoryCategory(deleteTarget.id);
      toast.success(i18n.t("inventorySales.categories.toasts.deactivated"));
      setConfirmOpen(false);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const renderActions = (cat) =>
    perms.canManageProducts ? (
      <Box display="flex" justifyContent="flex-end">
        <IconButton
          size="small"
          onClick={() => {
            setEditCategory(cat);
            setFormOpen(true);
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        {cat.active !== false ? (
          <IconButton
            size="small"
            onClick={() => {
              setDeleteTarget(cat);
              setConfirmOpen(true);
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
    ) : null;

  return (
    <Box>
      <div className={classes.headerRow}>
        <Typography variant="h6" style={{ fontWeight: 600 }}>
          {i18n.t("inventorySales.categories.title")}
        </Typography>
        {perms.canManageProducts ? (
          <AppPrimaryButton
            startIcon={<AddIcon />}
            onClick={() => {
              setEditCategory(null);
              setFormOpen(true);
            }}
          >
            {i18n.t("inventorySales.categories.new")}
          </AppPrimaryButton>
        ) : null}
      </div>

      <AppSectionCard variant="outlined" dense>
        {loading ? (
          <AppTableRowSkeleton columns={isMobile ? 1 : 5} />
        ) : loadError ? (
          <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
            <AppSecondaryButton onClick={load}>
              {i18n.t("inventorySales.common.retry")}
            </AppSecondaryButton>
          </AppEmptyState>
        ) : categories.length === 0 ? (
          <AppEmptyState
            title={i18n.t("inventorySales.categories.emptyTitle")}
            description={i18n.t("inventorySales.categories.emptyDescription")}
          >
            {perms.canManageProducts ? (
              <AppPrimaryButton
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditCategory(null);
                  setFormOpen(true);
                }}
              >
                {i18n.t("inventorySales.categories.new")}
              </AppPrimaryButton>
            ) : null}
          </AppEmptyState>
        ) : isMobile ? (
          <MobileCardList>
            {categories.map((cat) => (
              <MobileEntityCard
                key={cat.id}
                title={cat.name}
                subtitle={parentName(cat)}
                badges={
                  cat.active === false ? (
                    <Chip
                      size="small"
                      label={i18n.t("inventorySales.common.inactive")}
                    />
                  ) : null
                }
                footer={renderActions(cat)}
              >
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("inventorySales.categories.position")}: {cat.position ?? 0}
                </Typography>
              </MobileEntityCard>
            ))}
          </MobileCardList>
        ) : (
          <AppTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("inventorySales.categories.columns.name")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.categories.columns.parent")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.categories.columns.position")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.categories.columns.status")}</TableCell>
                  {perms.canManageProducts ? (
                    <TableCell align="right">
                      {i18n.t("inventorySales.common.actions")}
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell>{parentName(cat)}</TableCell>
                    <TableCell>{cat.position ?? 0}</TableCell>
                    <TableCell>
                      {cat.active === false ? (
                        <Chip
                          size="small"
                          label={i18n.t("inventorySales.common.inactive")}
                        />
                      ) : (
                        <Chip
                          size="small"
                          color="primary"
                          label={i18n.t("inventorySales.common.active")}
                        />
                      )}
                    </TableCell>
                    {perms.canManageProducts ? (
                      <TableCell align="right">{renderActions(cat)}</TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}
      </AppSectionCard>

      <CategoryFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        category={editCategory}
        categories={categories}
        onSaved={load}
      />

      <ConfirmationModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDeactivate}
        title={i18n.t("inventorySales.categories.deactivateTitle")}
      >
        {i18n.t("inventorySales.categories.deactivateMessage", {
          name: deleteTarget?.name || "",
        })}
      </ConfirmationModal>
    </Box>
  );
}
