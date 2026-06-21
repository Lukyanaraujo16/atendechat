import { useEffect, useRef } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import { i18n } from "../translate/i18n";
import {
  clearInstagramOAuthQueryParams,
  getInstagramOAuthCallbackParams,
  mapInstagramOAuthReason,
} from "../utils/instagramOAuth";

const useInstagramOAuthCallback = ({ onSuccess }) => {
  const location = useLocation();
  const history = useHistory();
  const handledRef = useRef(false);

  useEffect(() => {
    const callback = getInstagramOAuthCallbackParams(location.search);
    if (!callback || handledRef.current) {
      return;
    }

    handledRef.current = true;

    if (callback.result === "success") {
      toast.success(i18n.t("connections.instagram.oauth.success"));
      if (onSuccess) {
        onSuccess(callback.accountId);
      }
    } else {
      toast.error(mapInstagramOAuthReason(callback.reason));
      if (onSuccess) {
        onSuccess(null);
      }
    }

    clearInstagramOAuthQueryParams(history);
  }, [location.search, history, onSuccess]);
};

export default useInstagramOAuthCallback;
