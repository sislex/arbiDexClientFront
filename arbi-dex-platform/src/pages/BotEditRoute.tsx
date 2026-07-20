import { useParams } from 'react-router-dom'
import { isServerBotId } from '../services/botsApi'
import { BotEditorPage } from './BotEditorPage'
import { ServerBotEditorPage } from './ServerBotEditorPage'

export function BotEditRoute() {
  const { id } = useParams<{ id: string }>()
  if (id && isServerBotId(id)) {
    return <ServerBotEditorPage botId={id} />
  }
  return <BotEditorPage />
}
