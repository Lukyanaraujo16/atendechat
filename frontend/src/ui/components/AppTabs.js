import React from "react";
import clsx from "clsx";
import Tabs from "@material-ui/core/Tabs";
import useAppTabsStyles from "../styles/useAppTabsStyles";

/**
 * Abas alinhadas ao design system (indicador, tipografia, sem ALL CAPS).
 */
const AppTabs = React.forwardRef(function AppTabs(
  { className, classes: classesProp, ...rest },
  ref
) {
  const styles = useAppTabsStyles();
  return (
    <Tabs
      ref={ref}
      className={className}
      classes={{
        ...classesProp,
        root: clsx(styles.root, classesProp?.root),
        indicator: clsx(styles.indicator, classesProp?.indicator),
      }}
      {...rest}
    />
  );
});

export default AppTabs;
