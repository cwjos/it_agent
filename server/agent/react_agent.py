from langchain.agents import create_agent
from util.prompt_loader import load_system_prompts
from model.factory import chat_model
from .middleware import monitor_tool,log_before_model,report_prompt_switch
from .agent_tools import (rag_summarize, get_weather, get_user_location, get_user_id, get_current_month,
                       fetch_external_data, fill_context_for_report)
from langchain_core.messages import AIMessageChunk


class ReactAgent:
    def __init__(self):
        self.agent = create_agent(
            model=chat_model,
            system_prompt=load_system_prompts(),
            tools=[rag_summarize, get_weather, get_user_location, get_user_id, get_current_month,
                       fetch_external_data, fill_context_for_report],
            middleware=[monitor_tool, log_before_model, report_prompt_switch],
        )

    # react_agent.py
    async def execute_stream_async(self, query: str):
        input_dict = {"messages": [{"role": "user", "content": query}]}
        config = {"configurable": {"report": False}}
        async for chunk, metadata in self.agent.astream(
                input_dict,
                stream_mode="messages",
                config=config,
        ):
            # 只处理 AI 消息块且内容非空
            if isinstance(chunk, AIMessageChunk) and chunk.content:
                yield chunk.content



if __name__ == '__main__':
    agent = ReactAgent()
    for chunk in agent.execute_stream("给我生成我的使用报告"):
        print(chunk,end="",flush=True)