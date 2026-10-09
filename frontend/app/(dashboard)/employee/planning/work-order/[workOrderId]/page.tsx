import HeadWorkOrderPlanningPage from '@/app/components/planning/HeadWorkOrderPlanningPage'

export default async function EmployeeWorkOrderPlanningPage({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params
  return <HeadWorkOrderPlanningPage workOrderId={workOrderId} basePath="/employee" />
}
