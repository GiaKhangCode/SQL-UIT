import { useLanguage } from "../../../../context/LanguageContext";
import { TranslatedText } from "../../../../components/TranslatedText";
import { describeSqlError } from "../../../../utils/sqlErrors";

export function SqlErrorMessage({ message }: { message: string }) {
  const { t: tr } = useLanguage("workspace");
  const error = describeSqlError(message);
  return <div className="workspace-sql-error">
    <strong><TranslatedText>{tr(error.title, error.values)}</TranslatedText></strong>
    {error.detail && <p><TranslatedText>{tr(error.detail, error.values)}</TranslatedText></p>}
  </div>;
}
