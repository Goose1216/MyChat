def sqlalchemy_to_pydantic(pydantic_model):
    def validator(v):
        if isinstance(v, pydantic_model):
            return v
        if hasattr(v, "__dict__"):
            return pydantic_model.model_validate(v)
        return v
    return validator
