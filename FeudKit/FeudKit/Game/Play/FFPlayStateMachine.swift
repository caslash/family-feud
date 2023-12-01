//
//  FFPlayStateMachine.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation
import GameKit

public class FFPlayStateMachine: AbstractFFStateMachine<FFPlayStateType, FFPlayState> {
    private var questions: QuestionSet
    
    private var families: FamilyCollection
    
    public init(questions: QuestionSet, families: FamilyCollection) {
        self.questions = questions
        self.families = families
        super.init(name: "FFGame.Play")
    }
    
    public override func initialize() {
        self.addState(name: FFPlayStateType.SELECT_QUESTION.description, state: FFPlayStateFactory.getState(type: FFPlayStateType.SELECT_QUESTION, data: questions)!)
        self.addState(name: FFPlayStateType.FACE_OFF.description, state: FFPlayStateFactory.getState(type: FFPlayStateType.FACE_OFF, data: questions)!)
        self.addState(name: FFPlayStateType.FAMILY_PLAY.description, state: FFPlayStateFactory.getState(type: FFPlayStateType.FAMILY_PLAY, data: nil)!)
        self.addState(name: FFPlayStateType.FAMILY_STEAL.description, state: FFPlayStateFactory.getState(type: FFPlayStateType.FAMILY_STEAL, data: nil)!)
        self.addState(name: FFPlayStateType.ALLOCATE_POINTS.description, state: FFPlayStateFactory.getState(type: FFPlayStateType.ALLOCATE_POINTS, data: families)!)
        self.addState(name: FFPlayStateType.REVEAL_ANSWERS.description, state: FFPlayStateFactory.getState(type: FFPlayStateType.REVEAL_ANSWERS, data: nil)!)
        
        _ = self.changeState(name: FFPlayStateType.SELECT_QUESTION.description)
    }
    
    public override func validateStateTransition(currentState: FFPlayState?, nextState: String) -> Bool {
        if let currentState {
            switch currentState.getType() {
            case .ALLOCATE_POINTS:
                return nextState == FFPlayStateType.REVEAL_ANSWERS.description
            case .FACE_OFF:
                return nextState == FFPlayStateType.FAMILY_PLAY.description
            case .FAMILY_PLAY:
                return nextState == FFPlayStateType.FAMILY_STEAL.description ||
                    nextState == FFPlayStateType.ALLOCATE_POINTS.description
            case .FAMILY_STEAL:
                return nextState == FFPlayStateType.ALLOCATE_POINTS.description
            case .REVEAL_ANSWERS:
                return nextState == FFPlayStateType.SELECT_QUESTION.description
            case .SELECT_QUESTION:
                return nextState == FFPlayStateType.FACE_OFF.description
            }
        }
        
        return false
    }
    
    public func getCurrentStateType() -> FFPlayStateType? {
        if let currentState {
            return currentState.getType()
        }
        return nil
    }
}
