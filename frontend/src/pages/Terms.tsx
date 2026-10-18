import { useNavigate } from "react-router-dom"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "../components/ui/button"
import { useTranslation } from "../hooks/useTranslation"

export default function Terms() {
  const navigate = useNavigate()
  const { t, lang } = useTranslation()
  const isFa = lang === "fa"

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className={`mb-6 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50 ${isFa ? '-mr-4' : '-ml-4'}`}
        >
          {isFa ? <ArrowRight className="ml-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
          {t.terms?.back || "Back"}
        </Button>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          {t.terms?.title}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          {t.terms?.lastUpdated}
        </p>

        <div className="space-y-6 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.terms?.sections?.acceptance?.title}
            </h2>
            <p>{t.terms?.sections?.acceptance?.content}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.terms?.sections?.license?.title}
            </h2>
            <ul className="list-disc px-5 space-y-2">
              {t.terms?.sections?.license?.items?.map((item: string, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.terms?.sections?.privacy?.title}
            </h2>
            <p className="mb-2">{t.terms?.sections?.privacy?.p1}</p>
            <ul className="list-disc px-5 space-y-2">
              <li>
                <strong className="text-slate-900 dark:text-white font-semibold">
                  {t.terms?.sections?.privacy?.personalLabel}:{" "}
                </strong>
                {t.terms?.sections?.privacy?.personalText}
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white font-semibold">
                  {t.terms?.sections?.privacy?.usageLabel}:{" "}
                </strong>
                {t.terms?.sections?.privacy?.usageText}
              </li>
            </ul>
            <p className="mt-2">{t.terms?.sections?.privacy?.p2}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.terms?.sections?.liability?.title}
            </h2>
            <p>{t.terms?.sections?.liability?.content}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
              {t.terms?.sections?.modifications?.title}
            </h2>
            <p>{t.terms?.sections?.modifications?.content}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
