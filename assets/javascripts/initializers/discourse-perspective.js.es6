import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";

function initialize(api) {
  const siteSettings = api.container.lookup("site-settings:main");

  api.modifyClass("controller:composer", {
    _perspective_checked: null,

    perspectiveSave(force) {
      this.set("_perspective_checked", true);
      this.save(force).finally(() => {
        this.set("_perspective_checked", false);
      });
    },

    save(force) {
      // same validataion code from controller
      if (this.get("disableSubmit")) return;
      if (!this.get("showWarning")) {
        this.set("model.isWarning", false);
      }
      const composer = this.get("model");
      if (composer.get("cantSubmitPost")) {
        this.set("lastValidatedAt", Date.now());
        return;
      }

      const bypassPM =
        !siteSettings.perspective_check_private_message &&
        this.get("topic.isPrivateMessage");
      const bypassSecuredCategories =
        !siteSettings.perspective_check_secured_categories &&
        this.get("model.category.read_restricted");
      const bypassCheck = bypassPM || bypassSecuredCategories;
      if (!bypassCheck && !this.get("_perspective_checked")) {
        var concat = "";
        ["title", "raw", "reply"].forEach(item => {
          const content = composer.get(item);
          if (content) {
            concat += `${content} `;
          }
        });
        concat.trim();
        ajax(`/perspective/post_toxicity?concat=${encodeURIComponent(concat)}`)
          .then(response => {
            if (response && response["score"] !== undefined) {
              const message = I18n.t("perspective.perspective_message");

              let buttons = [
                {
                  label: I18n.t("perspective.composer_continue"),
                  class: "btn",
                  callback: () => this.perspectiveSave(force)
                },
                {
                  label: I18n.t("perspective.composer_edit"),
                  class: "btn-primary"
                }
              ];
              bootbox.dialog(message, buttons);
              return;
            } else {
              this.perspectiveSave(force);
            }
          })
          .catch(() => {
            // fail silently
            this.perspectiveSave(force);
          });
      } else {
        return this._super(force);
      }
    }
  });
}

export default {
  name: "discourse-perspective-api",

  initialize(container) {
    const siteSettings = container.lookup("site-settings:main");
    if (
      siteSettings.perspective_enabled &&
      siteSettings.perspective_notify_posting_min_toxicity_enable
    ) {
      withPluginApi("0.8.17", initialize);
    }
  }
};
