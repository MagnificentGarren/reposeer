from app.services.ast_parser import PythonASTParser


def test_parser_extracts_extended_function_metadata():
    result = PythonASTParser().parse_code(
        "tests/test_service.py",
        "@route('/items')\n"
        "async def fetch(item_id: int) -> str:\n"
        "    def normalize() -> str:\n"
        "        return str(item_id)\n"
        "    return normalize()\n",
    )

    function = result["functions"][0]
    assert result["is_test_file"] is True
    assert function["is_async"] is True
    assert function["decorators"] == ["@route('/items')"]
    assert function["parameters"] == "(item_id: int)"
    assert function["return_annotation"] == "str"
    assert function["nested_functions"][0]["name"] == "normalize"
    assert function["nested_functions"][0]["return_annotation"] == "str"


def test_parser_reports_syntax_errors():
    result = PythonASTParser().parse_code("broken.py", "def broken(:\n    pass\n")

    assert result["syntax_errors"]
    assert result["syntax_errors"][0]["line"] == 1


def test_parser_extracts_decorated_class_methods():
    result = PythonASTParser().parse_code(
        "app/service.py",
        "@dataclass\n"
        "class Service:\n"
        "    @staticmethod\n"
        "    async def run(value: int) -> None:\n"
        "        return None\n",
    )

    service = result["classes"][0]
    method = service["methods"][0]
    assert service["decorators"] == ["@dataclass"]
    assert method["decorators"] == ["@staticmethod"]
    assert method["is_async"] is True
