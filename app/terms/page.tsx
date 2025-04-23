import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TermsPage() {
  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Terms and Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using QuizGen, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. Use License</h2>
              <p className="text-muted-foreground">
                Permission is granted to temporarily use QuizGen for personal, non-commercial transitory viewing only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. User Responsibilities</h2>
              <p className="text-muted-foreground">
                Users are responsible for maintaining the confidentiality of their account information and for all activities that occur under their account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Content Guidelines</h2>
              <p className="text-muted-foreground">
                Users must ensure that all content uploaded for quiz generation complies with applicable laws and does not infringe on any third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                QuizGen shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 