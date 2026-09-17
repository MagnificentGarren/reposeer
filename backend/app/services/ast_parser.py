import tree_sitter_python as tspython  # type: ignore
from tree_sitter import Language, Parser  # type: ignore
from pathlib import PurePosixPath

# tree-sitter-python 0.21+ / tree-sitter 0.22+ returns the Language instance directly
PY_LANGUAGE = Language(tspython.language())


class PythonASTParser:
    """Statically parses Python code to extract structural metadata using Tree-Sitter."""

    def __init__(self):
        # Pass the language object directly into the Parser constructor
        try:
            self.parser = Parser(PY_LANGUAGE)
        except TypeError:
            self.parser = Parser()
            if hasattr(self.parser, "set_language"):
                self.parser.set_language(PY_LANGUAGE)
            else:
                self.parser.language = PY_LANGUAGE

    def parse_code(self, file_path: str, code: str) -> dict:
        """Parse Python source into structural metadata used by the inspection report."""
        tree = self.parser.parse(bytes(code, "utf-8"))
        root_node = tree.root_node

        classes = []
        functions = []
        imports = []

        for node in root_node.children:
            if node.type in ("import_statement", "import_from_statement"):
                imports.append(self._extract_import(node, code))
            elif self._definition_type(node) == "class_definition":
                classes.append(self._extract_class(self._definition_node(node), code, node))
            elif self._definition_type(node) == "function_definition":
                functions.append(self._extract_function(self._definition_node(node), code, node))

        return {
            "file_path": file_path,
            "imports": [i for i in imports if i],
            "classes": classes,
            "functions": functions,
            "is_test_file": self._is_test_file(file_path),
            "syntax_errors": self._extract_syntax_errors(root_node, code),
        }

    def _definition_type(self, node) -> str | None:
        if node.type in ("class_definition", "function_definition"):
            return node.type
        if node.type == "decorated_definition":
            definition = node.child_by_field_name("definition")
            return definition.type if definition else None
        return None

    def _definition_node(self, node):
        if node.type == "decorated_definition":
            return node.child_by_field_name("definition")
        return node

    def _is_test_file(self, file_path: str) -> bool:
        path = PurePosixPath(file_path.replace("\\", "/"))
        return (
            path.name.startswith("test_")
            or path.name.endswith("_test.py")
            or any(part.lower() in {"test", "tests"} for part in path.parts[:-1])
        )

    def _extract_syntax_errors(self, root_node, code: str) -> list[dict]:
        errors = []

        def visit(node) -> None:
            if node.type == "ERROR" or node.is_missing:
                errors.append({
                    "line": node.start_point[0] + 1,
                    "column": node.start_point[1] + 1,
                    "text": code[node.start_byte : node.end_byte].strip(),
                })
            for child in node.children:
                visit(child)

        visit(root_node)
        return errors

    def _extract_import(self, node, code: str) -> dict | None:
        raw_text = code[node.start_byte : node.end_byte].strip()
        if node.type == "import_statement":
            return {"type": "direct", "statement": raw_text}
        elif node.type == "import_from_statement":
            return {"type": "from", "statement": raw_text}
        return None

    def _extract_class(self, node, code: str, wrapper_node=None) -> dict:
        name_node = node.child_by_field_name("name")
        class_name = (
            code[name_node.start_byte : name_node.end_byte]
            if name_node
            else "Unknown"
        )

        methods = []
        body_node = node.child_by_field_name("body")
        if body_node:
            for child in body_node.children:
                if self._definition_type(child) == "function_definition":
                    methods.append(self._extract_function(self._definition_node(child), code, child))

        return {
            "name": class_name,
            "methods": methods,
            "docstring": (
                self._extract_docstring(body_node, code) if body_node else None
            ),
            "decorators": self._extract_decorators(wrapper_node or node, code),
        }

    def _extract_function(self, node, code: str, wrapper_node=None) -> dict:
        name_node = node.child_by_field_name("name")
        func_name = (
            code[name_node.start_byte : name_node.end_byte]
            if name_node
            else "Unknown"
        )

        body_node = node.child_by_field_name("body")
        nested_functions = []
        if body_node:
            for child in body_node.children:
                if self._definition_type(child) == "function_definition":
                    nested_functions.append(
                        self._extract_function(self._definition_node(child), code, child)
                    )

        parameters_node = node.child_by_field_name("parameters")
        return_type_node = node.child_by_field_name("return_type")
        return {
            "name": func_name,
            "docstring": (
                self._extract_docstring(body_node, code) if body_node else None
            ),
            "start_line": node.start_point[0] + 1,
            "end_line": node.end_point[0] + 1,
            "is_async": any(child.type == "async" for child in node.children),
            "decorators": self._extract_decorators(wrapper_node or node, code),
            "parameters": (
                code[parameters_node.start_byte : parameters_node.end_byte]
                if parameters_node
                else None
            ),
            "return_annotation": (
                code[return_type_node.start_byte : return_type_node.end_byte]
                if return_type_node
                else None
            ),
            "nested_functions": nested_functions,
        }

    def _extract_decorators(self, node, code: str) -> list[str]:
        if not node or node.type != "decorated_definition":
            return []
        return [
            code[child.start_byte : child.end_byte].strip()
            for child in node.children
            if child.type == "decorator"
        ]

    def _extract_docstring(self, body_node, code: str) -> str | None:
        if not body_node or not body_node.children:
            return None

        first_child = body_node.children[0]
        if first_child.type == "expression_statement":
            expr = first_child.children[0] if first_child.children else None
            if expr and expr.type == "string":
                return code[expr.start_byte : expr.end_byte].strip("\"' ")
        return None