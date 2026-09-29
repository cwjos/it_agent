from langchain_core.tools import tool
from rag.rag_service import RagSummarizeService
import random
import os
from util.config_handler import agent_conf
from util.path_tool import get_abs_path
from util.logger_handler import logger

rag = RagSummarizeService()
user_ids = ["1001","1002","1003","1004","1005","1006","1007","1008","1009","1010"]
month_arr = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
             "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]

external_data = {}

@tool(description="从向量存储中检索参考资料")
def rag_summarize(query: str) -> str:
    return rag.rag_summarize(query)

@tool(description="获取指定城市的天气，以消息字符串的形式返回")
def get_weather(city: str) -> str:
    return f"城市{city}天气为晴天，气温26摄氏度，空气湿度50%，南风1级，AQI21，最近6小时降雨概率极低"

@tool(description="获取用户所在城市的名称.以纯字符串形式返回")
def get_user_location() -> str:
    return random.choice(["深圳","合肥","杭州"])

@tool(description="获取用户的ID， 以纯字符串形式返回")
def get_user_id() -> str:
    return random.choice(user_ids)

@tool(description="获取当前月份，以纯字符串形式返回")
def get_current_month() -> str:
    return random.choice(month_arr)

def generate_external_data():
    """从CSV文件加载外部数据，按用户ID和月份分组"""
    global external_data
    if external_data:
        return

    external_data_path = get_abs_path(agent_conf["external_data_path"])
    if not os.path.exists(external_data_path):
        raise FileNotFoundError(f"外部数据{external_data_path}不存在")

    with open(external_data_path, "r", encoding="utf-8") as f:
        # 跳过标题行
        lines = f.readlines()
        if not lines:
            return
        # 假设第一行是标题
        headers = [h.strip('"') for h in lines[0].strip().split(",")]
        # 解析数据行
        for line in lines[1:]:
            if not line.strip():
                continue
            # 按逗号分割，并去除首尾引号
            parts = [p.strip().strip('"') for p in line.strip().split(",")]
            if len(parts) != len(headers):
                logger.warning(f"跳过格式不正确的行: {line}")
                continue

            row = dict(zip(headers, parts))
            user_id = row["用户ID"]
            month = row["发生月份"]

            # 构建记录字符串（可根据需要调整）
            record = (f"部门：{row['部门']}，问题分类：{row['问题分类']}，"
                      f"严重程度：{row['严重程度']}，解决状态：{row['解决状态']}，"
                      f"处理时长：{row['处理时长(分钟)']}分钟")

            if user_id not in external_data:
                external_data[user_id] = {}
            if month not in external_data[user_id]:
                external_data[user_id][month] = []
            external_data[user_id][month].append(record)

@tool(description="从外部系统中获取指定用户在指定月份的所有使用记录，以纯字符串形式返回多条记录，每条记录包含部门、问题分类、严重程度、解决状态和处理时长；如果未检索到返回空字符串")
def fetch_external_data(user_id: str, month: str) -> str:
    generate_external_data()
    try:
        records = external_data[user_id][month]
        if not records:
            return ""
        # 拼接多条记录，用分号分隔
        return "；".join(records)
    except KeyError:
        logger.warning(f"[fetch_external_data]未能检索到用户：{user_id}在{month}的使用记录数据")
        return ""

@tool(description="无入参，无返回值，调用后触发中间件自动为报告生成场景动态注入上下文信息，为后续提示词切换提供上下文信息")
def fill_context_for_report():
    return "fill_context_for_report已调用"


if __name__ == '__main__':
    # 测试
    print(fetch_external_data("1001", "2026-01"))