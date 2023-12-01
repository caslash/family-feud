//
//  FFStateMachine.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class FFStateMachine: AbstractFFStateMachine<FFStateType, FFState> {
    private var game: FamilyFeudGame
    
    private var families: FamilyCollection
    
    private var questions: QuestionSet
    
    private var fromFastMoney: FFStateType? = nil
    
    public init(game: FamilyFeudGame, families: FamilyCollection, questions: QuestionSet) {
        self.game = game
        self.families = families
        self.questions = questions
        super.init(name: "FFGame")
    }
    
    public override func initialize() {
        self.addState(name: FFStateType.START.description, state: FFStateFactory.getState(type: FFStateType.START, data: nil)!);
        self.addState(name: FFStateType.NEW_GAME.description, state: FFStateFactory.getState(type: FFStateType.NEW_GAME, data: game)!);
        self.addState(name: FFStateType.ADD_FAMILY.description, state: FFStateFactory.getState(type: FFStateType.ADD_FAMILY, data: families)!);
        self.addState(name: FFStateType.LOAD_QUESTIONS.description, state: FFStateFactory.getState(type: FFStateType.LOAD_QUESTIONS, data: questions)!);
        self.addState(name: FFStateType.INITIALIZE_GAME.description, state: FFStateFactory.getState(type: FFStateType.INITIALIZE_GAME, data: nil)!);
        self.addState(name: FFStateType.PLAY.description, state: FFStateFactory.getState(type: FFStateType.PLAY, data: game)!);
        self.addState(name: FFStateType.END_GAME.description, state: FFStateFactory.getState(type: FFStateType.END_GAME, data: game)!);
        self.addState(name: FFStateType.FAST_MONEY.description, state: FFStateFactory.getState(type: FFStateType.FAST_MONEY, data: game)!);
        
        _ = self.changeState(name: FFStateType.START.description)
    }
    
    public override func validateStateTransition(currentState: FFState?, nextState: String) -> Bool {
        if (currentState == nil) { return true }
            
        switch currentState!.getType() {
        case FFStateType.ADD_FAMILY, FFStateType.LOAD_QUESTIONS:
            if (nextState == FFStateType.ADD_FAMILY.description) { return true }
            if (nextState == FFStateType.LOAD_QUESTIONS.description) { return true }
            if (nextState == FFStateType.INITIALIZE_GAME.description) {
                if (self.families.size() > 1) {
                    if (self.questions.getQuestions().count > 0) {
                        return true
                    } else {
                        //TODO: Logger
                    }
                } else {
                    //TODO: Logger
                }
            }
            break
        case FFStateType.NEW_GAME:
            if (nextState == FFStateType.ADD_FAMILY.description) { return true }
            if (nextState == FFStateType.LOAD_QUESTIONS.description) { return true }
            break
        case FFStateType.END_GAME:
            if (nextState == FFStateType.NEW_GAME.description) { return true }
            if (nextState == FFStateType.FAST_MONEY.description) {
                self.fromFastMoney = currentState!.getType()
                return true
            }
            break
        case FFStateType.INITIALIZE_GAME:
            if (nextState == FFStateType.PLAY.description) { return true }
            break
        case FFStateType.PLAY:
            if (nextState == FFStateType.END_GAME.description) { return true }
            if (nextState == FFStateType.FAST_MONEY.description) {
                self.fromFastMoney = currentState!.getType()
                return true
            }
            break
        case FFStateType.START:
            if (nextState == FFStateType.NEW_GAME.description) { return true }
            break
        case FFStateType.FAST_MONEY:
            if (nextState == fromFastMoney!.description) { return true }
            return true
        default:
            return false
        }
        
        return false
    }
    
    public func getCurrentStateType() -> FFStateType? {
        if let currentState {
            return currentState.getType()
        }
        return nil
    }
}
