"""
Normalize tech stack và domain names về dạng chuẩn.
Real-world: user có thể nhập "Nodejs", "NodeJS", "node.js", "Node" — tất cả đều là "Node.js".
Mapping này đảm bảo filter match chính xác giữa data lưu trong Qdrant và query từ LLM.
"""

# Mapping: lowercase variant -> canonical name
TECH_STACK_ALIASES: dict[str, str] = {
    # Node.js variants
    "nodejs": "Node.js",
    "node": "Node.js",
    "node.js": "Node.js",
    "nodej": "Node.js",
    # React variants
    "react": "React",
    "reactjs": "React",
    "react.js": "React",
    # Next.js variants
    "nextjs": "Next.js",
    "next": "Next.js",
    "next.js": "Next.js",
    # Vue variants
    "vue": "Vue.js",
    "vuejs": "Vue.js",
    "vue.js": "Vue.js",
    # Angular
    "angular": "Angular",
    "angularjs": "Angular",
    # Python
    "python": "Python",
    # FastAPI
    "fastapi": "FastAPI",
    "fast-api": "FastAPI",
    # MongoDB
    "mongodb": "MongoDB",
    "mongo": "MongoDB",
    # PostgreSQL
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "pg": "PostgreSQL",
    # Flutter
    "flutter": "Flutter",
    # React Native
    "react native": "React Native",
    "react-native": "React Native",
    "reactnative": "React Native",
    # Golang
    "golang": "Golang",
    "go": "Golang",
    # AWS
    "aws": "AWS",
    # Docker
    "docker": "Docker",
    # TypeScript
    "typescript": "TypeScript",
    "ts": "TypeScript",
    # JavaScript
    "javascript": "JavaScript",
    "js": "JavaScript",
}


def normalize_tech_name(name: str) -> str:
    """Normalize 1 tên tech về dạng chuẩn."""
    return TECH_STACK_ALIASES.get(name.strip().lower(), name.strip())


def normalize_tech_list(tech_list: list[str]) -> list[str]:
    """Normalize danh sách tech_stack, loại bỏ duplicates sau khi normalize."""
    seen: set[str] = set()
    result: list[str] = []
    for name in tech_list:
        normalized = normalize_tech_name(name)
        if normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result
